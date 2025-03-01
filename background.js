chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveToNotion") {
    saveToNotion(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
});

async function saveToNotion(data) {
  // Get Notion settings from storage
  const storage = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
  
  if (!storage.notionApiKey || !storage.notionDatabaseId) {
    throw new Error("Notion API key or database ID not configured");
  }
  
  // First, query the database to check if the record already exists
  const existingPage = await findExistingPage(storage.notionApiKey, storage.notionDatabaseId, data.url);
  
  // Prepare the Notion page data
  const pageData = {
    properties: {
      // Using name as title since Notion requires a title property
      Name: {
        title: [
          {
            text: {
              content: data.name // Still need name as a title for Notion
            }
          }
        ]
      },
      "Accords": {
        multi_select: data.mainAccords.map(accord => ({ name: accord }))
      },
      "Top Notes": {
        multi_select: data.topNotes.map(note => ({ name: note }))
      },
      "Middle Notes": {
        multi_select: data.middleNotes.map(note => ({ name: note }))
      },
      "Base Notes": {
        multi_select: data.baseNotes.map(note => ({ name: note }))
      },
      // Add general notes field for perfumes without top/middle/base categorization
      "Notes": {
        multi_select: data.generalNotes ? data.generalNotes.map(note => ({ name: note })) : []
      },
      "URL": {
        url: data.url
      }
    }
  };
  
  // Add season and time data as multi-select properties
  if (data.seasonData) {
    // Create Seasons multi-select
    const seasons = [];
    if (data.seasonData.winter) seasons.push({ name: "Winter" });
    if (data.seasonData.spring) seasons.push({ name: "Spring" });
    if (data.seasonData.summer) seasons.push({ name: "Summer" });
    if (data.seasonData.fall) seasons.push({ name: "Fall" });
    pageData.properties["Seasons"] = { multi_select: seasons };
    
    // Create Time multi-select
    const times = [];
    if (data.seasonData.day) times.push({ name: "Day" });
    if (data.seasonData.night) times.push({ name: "Night" });
    pageData.properties["Time"] = { multi_select: times };
  }
  
  // If there's an image URL, add it
  if (data.imageUrl) {
    pageData.cover = {
      type: "external",
      external: {
        url: data.imageUrl
      }
    };
  }
  
  let response;
  let wasUpdated = false;
  
  // If a page with this URL already exists, update it
  if (existingPage) {
    wasUpdated = true;
    
    // Create a reduced properties object with only the fields we want to update
    const reducedProperties = {
      "Accords": pageData.properties["Accords"],
      "Top Notes": pageData.properties["Top Notes"],
      "Middle Notes": pageData.properties["Middle Notes"],
      "Base Notes": pageData.properties["Base Notes"],
      "Notes": pageData.properties["Notes"],
      "URL": pageData.properties["URL"]
    };
    
    // Add season and time data to the reduced properties
    if (data.seasonData) {
      // Add Seasons multi-select
      const seasons = [];
      if (data.seasonData.winter) seasons.push({ name: "Winter" });
      if (data.seasonData.spring) seasons.push({ name: "Spring" });
      if (data.seasonData.summer) seasons.push({ name: "Summer" });
      if (data.seasonData.fall) seasons.push({ name: "Fall" });
      reducedProperties["Seasons"] = { multi_select: seasons };
      
      // Add Time multi-select
      const times = [];
      if (data.seasonData.day) times.push({ name: "Day" });
      if (data.seasonData.night) times.push({ name: "Night" });
      reducedProperties["Time"] = { multi_select: times };
    }
    response = await fetch(`https://api.notion.com/v1/pages/${existingPage.id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${storage.notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: reducedProperties,
        // Do not update cover when updating an existing record
      })
    });
  } else {
    // No existing page found, create a new one
    pageData.parent = { database_id: storage.notionDatabaseId };
    
    response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storage.notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pageData)
    });
  }
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Notion API error: ${errorData.message}`);
  }
  
  const result = await response.json();
  result.wasUpdated = wasUpdated;
  
  return result;
}

// Helper function to find an existing page with the same URL
async function findExistingPage(apiKey, databaseId, url) {
  // Use the Notion database query API to find pages with the matching URL
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filter: {
        property: "URL",
        url: {
          equals: url
        }
      }
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Notion API error when querying database: ${errorData.message}`);
  }
  
  const data = await response.json();
  
  // Return the first page with the matching URL, or null if none found
  return data.results.length > 0 ? data.results[0] : null;
}