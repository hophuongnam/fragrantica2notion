document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId'], function(result) {
    document.getElementById('notionApiKey').value = result.notionApiKey || '';
    document.getElementById('notionDatabaseId').value = result.notionDatabaseId || '';
    
    // Check if settings are configured and toggle visibility
    const hasSettings = result.notionApiKey && result.notionDatabaseId;
    toggleSettingsVisibility(hasSettings);
  });
  
  // Function to toggle settings visibility
  function toggleSettingsVisibility(hideSettings) {
    if (hideSettings) {
      document.getElementById('notionSettings').style.display = 'none';
      document.getElementById('notionSettingsCollapsed').style.display = 'block';
    } else {
      document.getElementById('notionSettings').style.display = 'block';
      document.getElementById('notionSettingsCollapsed').style.display = 'none';
    }
  }
  
  // Show settings button click handler
  document.getElementById('showSettings').addEventListener('click', function() {
    toggleSettingsVisibility(false);
  });
  
  // Save settings
  document.getElementById('saveSettings').addEventListener('click', function() {
    const notionApiKey = document.getElementById('notionApiKey').value.trim();
    const notionDatabaseId = document.getElementById('notionDatabaseId').value.trim();
    
    if (notionApiKey && notionDatabaseId) {
      chrome.storage.sync.set({
        notionApiKey: notionApiKey,
        notionDatabaseId: notionDatabaseId
      }, function() {
        const message = document.getElementById('settingsSavedMessage');
        message.classList.remove('hidden');
        
        // Hide the message after delay
        setTimeout(() => {
          message.classList.add('hidden');
          
          // Hide settings section after saving
          toggleSettingsVisibility(true);
        }, 2000);
      });
    } else {
      alert('Please enter both Notion API key and database ID');
    }
  });
  
  // Extract data button
  let extractedData = null;
  
  document.getElementById('extractDataBtn').addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      
      // Check if we're on a Fragrantica page
      if (!activeTab.url.includes('fragrantica.com')) {
        document.getElementById('extractError').textContent = 'Please navigate to a Fragrantica perfume page';
        document.getElementById('extractError').classList.remove('hidden');
        return;
      }
      
      // Extract data using the content script
      chrome.tabs.sendMessage(activeTab.id, {action: "extractData"}, function(response) {
        if (chrome.runtime.lastError) {
          document.getElementById('extractError').textContent = 'Error: ' + chrome.runtime.lastError.message;
          document.getElementById('extractError').classList.remove('hidden');
          return;
        }
        
        if (!response || !response.data) {
          document.getElementById('extractError').textContent = 'Could not extract data. Make sure you\'re on a perfume details page.';
          document.getElementById('extractError').classList.remove('hidden');
          return;
        }
        
        // Console log for debugging
        console.log('Extracted data:', response.data);
        
        // Hide error message if it was shown
        document.getElementById('extractError').classList.add('hidden');
        
        // Store the extracted data
        extractedData = response.data;
        
        // Display a preview of the data
        const previewDiv = document.getElementById('dataPreview');
        
        // Start with common elements
        let previewHTML = `
          <div><span>Accords:</span> ${extractedData.mainAccords.join(', ') || 'None'}</div>
          <div><span>Top Notes:</span> ${extractedData.topNotes.join(', ') || 'None'}</div>
          <div><span>Middle Notes:</span> ${extractedData.middleNotes.join(', ') || 'None'}</div>
          <div><span>Base Notes:</span> ${extractedData.baseNotes.join(', ') || 'None'}</div>
        `;
        
        // Add general notes if available
        if (extractedData.generalNotes && extractedData.generalNotes.length > 0) {
          previewHTML += `<div><span>General Notes:</span> ${extractedData.generalNotes.join(', ')}</div>`;
        }
        
        // Always show the specific notes sections
        // Add season and time data as separate entries in preview
      if (extractedData.seasonData) {
        // Seasons (Winter, Spring, Summer, Fall)
        const seasons = [];
        if (extractedData.seasonData.winter) seasons.push('Winter');
        if (extractedData.seasonData.spring) seasons.push('Spring');
        if (extractedData.seasonData.summer) seasons.push('Summer');
        if (extractedData.seasonData.fall) seasons.push('Fall');
        
        previewHTML += `<div><span>Seasons:</span> ${seasons.length > 0 ? seasons.join(', ') : 'None'}</div>`;
        
        // Time (Day, Night)
        const times = [];
        if (extractedData.seasonData.day) times.push('Day');
        if (extractedData.seasonData.night) times.push('Night');
        
        previewHTML += `<div><span>Time:</span> ${times.length > 0 ? times.join(', ') : 'None'}</div>`;
      }
        previewDiv.innerHTML = previewHTML;
        previewDiv.classList.remove('hidden');
        

        
        // Enable the save button
        document.getElementById('saveToNotionBtn').disabled = false;
      });
    });
  });
  

  
  // Save to Notion button
  document.getElementById('saveToNotionBtn').addEventListener('click', function() {
    if (!extractedData) {
      return;
    }
    
    // Check if settings are saved
    chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId'], function(result) {
      if (!result.notionApiKey || !result.notionDatabaseId) {
        document.getElementById('saveError').textContent = 'Please save your Notion API key and database ID first';
        document.getElementById('saveError').classList.remove('hidden');
        return;
      }
      
      // Show saving status and disable buttons
      document.getElementById('savingStatus').classList.remove('hidden');
      document.getElementById('saveSuccess').classList.add('hidden');
      document.getElementById('saveError').classList.add('hidden');
      document.getElementById('saveToNotionBtn').disabled = true;
      document.getElementById('extractDataBtn').disabled = true;
      
      // Send data to the background script to save to Notion
      chrome.runtime.sendMessage({
        action: "saveToNotion", 
        data: extractedData
      }, function(response) {
        // Hide the loading status
        document.getElementById('savingStatus').classList.add('hidden');
        document.getElementById('extractDataBtn').disabled = false;
        
        if (response.success) {
          // Check if this was an update or a new record
          const wasUpdated = response.result && response.result.wasUpdated;
          
          document.getElementById('saveSuccess').textContent = wasUpdated ?
            'Successfully updated in Notion!' :
            'Successfully saved to Notion!';
          document.getElementById('saveSuccess').classList.remove('hidden');
          document.getElementById('saveError').classList.add('hidden');
          
          // Keep the save button disabled to prevent duplicate saves
          document.getElementById('saveToNotionBtn').disabled = true;
          
          setTimeout(() => {
            document.getElementById('saveSuccess').classList.add('hidden');
          }, 3000);
        } else {
          document.getElementById('saveError').textContent = 'Error: ' + response.error;
          document.getElementById('saveError').classList.remove('hidden');
          document.getElementById('saveSuccess').classList.add('hidden');
          
          // Re-enable the save button on error so user can retry
          document.getElementById('saveToNotionBtn').disabled = false;
        }
      });
    });
  });
});