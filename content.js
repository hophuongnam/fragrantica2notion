// This script runs on fragrantica.com pages to extract perfume data

function extractPerfumeData() {
  // Check if we're on a perfume page
  if (!window.location.pathname.includes('/perfume/')) {
    return null;
  }
  
  console.log('Starting perfume data extraction');
  
  try {
    // Extract basic info
    const name = document.querySelector('h1[itemprop="name"]')?.textContent.trim() || '';
    const brand = document.querySelector('.brand a')?.textContent.trim() || '';
    
    // Extract release year
    const yearElement = Array.from(document.querySelectorAll('.cell.small-12 .small-6'))
      .find(el => el.textContent.includes('Release year'));
    const year = yearElement ? 
      yearElement.nextElementSibling?.textContent.trim() : '';
    
    // Extract main accords
    const mainAccords = Array.from(document.querySelectorAll('div.accord-box'))
      .map(el => el.textContent.trim())
      .filter(Boolean);
    
    // Extract notes with multiple backup strategies
    function extractNotes(section) {
      console.log(`Extracting ${section} notes...`);
      
      // First, try direct selector approach based on the HTML structure
      try {
        // Get the pyramid container
        const pyramid = document.getElementById('pyramid');
        if (!pyramid) {
          console.log('No pyramid element found');
          return tryAlternativeExtraction(section);
        }
        
        console.log('Found pyramid element:', pyramid);
        
        // Log all headings in the pyramid for debugging
        const allHeadings = pyramid.querySelectorAll('h4');
        console.log(`Found ${allHeadings.length} h4 headings:`, Array.from(allHeadings).map(h => h.textContent));
        
        // Find the heading containing our section name
        const headingText = `${section} Notes`;
        const sectionHeadings = Array.from(pyramid.querySelectorAll('h4')).filter(h =>
          h.textContent.trim().toLowerCase().includes(headingText.toLowerCase())
        );
        
        if (sectionHeadings.length === 0) {
          console.log(`No heading found containing "${headingText}"`);
          return tryAlternativeExtraction(section);
        }
        
        const sectionHeading = sectionHeadings[0];
        console.log(`Found section heading: "${sectionHeading.textContent}"`);
        
        // Try to find the div with flex display that contains the notes
        // Navigate DOM to find the right container
        let current = sectionHeading;
        let flexContainer = null;
        
        // Look at next siblings until we find a div with notes or hit another heading
        while (current.nextElementSibling &&
               !current.nextElementSibling.tagName.toLowerCase().startsWith('h') &&
               !flexContainer) {
          
          current = current.nextElementSibling;
          
          // Try to find a flex container within this element
          if (current.tagName.toLowerCase() === 'div') {
            // Option 1: Direct flex container
            if (current.getAttribute('style') &&
                current.getAttribute('style').includes('display: flex')) {
              flexContainer = current;
              console.log('Found flex container directly');
            }
            // Option 2: Nested flex container
            else {
              const nestedFlex = current.querySelector('div[style*="display: flex"]');
              if (nestedFlex) {
                flexContainer = nestedFlex;
                console.log('Found nested flex container');
              }
            }
          }
        }
        
        if (!flexContainer) {
          console.log('No flex container found');
          return tryAlternativeExtraction(section);
        }
        
        console.log('Flex container:', flexContainer);
        
        // Get all note containers
        const noteContainers = flexContainer.querySelectorAll('div[style*="flex-direction: column"]');
        console.log(`Found ${noteContainers.length} note containers`);
        
        // Extract the notes - in Fragrantica's HTML, the note name is a text node after the <a> tag
        const notes = Array.from(noteContainers).map(container => {
          // Get the second div (containing the text)
          const textDiv = container.querySelector('div:nth-child(2)');
          if (!textDiv) return null;
          
          // Get the entire text content
          return textDiv.textContent.trim();
        }).filter(Boolean);
        
        console.log(`Extracted ${notes.length} ${section} notes:`, notes);
        
        if (notes.length > 0) {
          return notes;
        } else {
          console.log('No notes found, trying alternative method');
          return tryAlternativeExtraction(section);
        }
      } catch (error) {
        console.error(`Error extracting ${section} notes:`, error);
        return tryAlternativeExtraction(section);
      }
    }
    
    // Alternative extraction methods if the primary one fails
    function tryAlternativeExtraction(section) {
      console.log(`Trying alternative extraction for ${section} notes`);
      
      // Method 1: Try using section-specific selectors
      try {
        // This is a more direct approach for the HTML structure you shared
        if (section === 'Top') {
          const notes = document.querySelectorAll('#pyramid h4 b:contains("Top Notes")').closest('h4').next('div').find('a');
          if (notes.length > 0) {
            return Array.from(notes).map(a => a.textContent.trim());
          }
        } else if (section === 'Middle') {
          const notes = document.querySelectorAll('#pyramid h4 b:contains("Middle Notes")').closest('h4').next('div').find('a');
          if (notes.length > 0) {
            return Array.from(notes).map(a => a.textContent.trim());
          }
        } else if (section === 'Base') {
          const notes = document.querySelectorAll('#pyramid h4 b:contains("Base Notes")').closest('h4').next('div').find('a');
          if (notes.length > 0) {
            return Array.from(notes).map(a => a.textContent.trim());
          }
        }
      } catch (error) {
        console.error('Error in alternative method 1:', error);
      }
      
      // Method 2: Try a more generic approach - find all links after the heading
      try {
        // Find all h4/h3 elements containing our section name
        const allHeadings = document.querySelectorAll('h3, h4');
        const sectionHeading = Array.from(allHeadings).find(h =>
          h.textContent.toLowerCase().includes(`${section.toLowerCase()} notes`)
        );
        
        if (sectionHeading) {
          // Get all links in the next few elements until another heading
          const notes = [];
          let current = sectionHeading.nextElementSibling;
          
          while (current && !current.tagName.toLowerCase().startsWith('h')) {
            const links = current.querySelectorAll('a');
            notes.push(...Array.from(links).map(a => a.textContent.trim()));
            current = current.nextElementSibling;
          }
          
          if (notes.length > 0) {
            console.log(`Found ${notes.length} notes using method 2`);
            return notes;
          }
        }
      } catch (error) {
        console.error('Error in alternative method 2:', error);
      }
      
      // Method 3: Most generic - find any mention of notes in the text and use regex
      try {
        // Look for content containing "top notes", "middle notes", etc.
        const pageText = document.body.textContent;
        const regex = new RegExp(`${section} notes[^a-z]+(([a-z\\s]+),\\s*)+`, 'i');
        const match = pageText.match(regex);
        
        if (match && match[1]) {
          const noteText = match[0];
          const notes = noteText.split(',').map(n => n.trim()).filter(n => n.length > 0);
          
          if (notes.length > 0) {
            console.log(`Found ${notes.length} notes using text regex`);
            return notes;
          }
        }
      } catch (error) {
        console.error('Error in alternative method 3:', error);
      }
      
      console.log(`Failed to extract ${section} notes using all methods`);
      return [];
    }
    
    console.log('Extracting notes...');
    // Try a direct approach first since we know the structure
    console.log('Attempting direct extraction based on structure...');
    let topNotes = [];
    let middleNotes = [];
    let baseNotes = [];
    
    try {
      // Direct selectors based on the HTML you shared
      const allLinks = document.querySelectorAll('#pyramid a');
      console.log(`Found ${allLinks.length} total links in pyramid`);
      
      // Extract all notes with their sections
      const allNotes = [];
      
      document.querySelectorAll('#pyramid h4').forEach(heading => {
        const sectionName = heading.textContent.trim();
        console.log(`Found section: ${sectionName}`);
        
        let current = heading.nextElementSibling;
        if (current && current.querySelectorAll) {
          // Find all divs that contain notes
          const noteContainers = current.querySelectorAll('div[style*="display: flex"][style*="justify-content: center"][style*="flex-direction: column"]');
          console.log(`Found ${noteContainers.length} note containers in ${sectionName}`);
          
          // Extract notes - in Fragrantica, the note name is often a text node after the <a> tag
          const notes = Array.from(noteContainers).map(container => {
            // Get the div that contains both the <a> tag and the text
            const textDiv = container.querySelector('div:nth-child(2)');
            if (!textDiv) return '';
            
            // Get the text content and clean it up
            const fullText = textDiv.textContent.trim();
            console.log(`Raw note text: "${fullText}"`);
            return fullText;
          }).filter(note => note.length > 0);
          
          console.log(`Found ${notes.length} notes in ${sectionName}:`, notes);
          
          if (sectionName.toLowerCase().includes('top')) {
            topNotes = notes;
          } else if (sectionName.toLowerCase().includes('middle')) {
            middleNotes = notes;
          } else if (sectionName.toLowerCase().includes('base')) {
            baseNotes = notes;
          }
        }
      });
    } catch (error) {
      console.error('Error in direct extraction:', error);
    }
    
    // If direct extraction failed, try the main extraction function
    if (topNotes.length === 0) {
      topNotes = extractNotes('Top');
    }
    if (middleNotes.length === 0) {
      middleNotes = extractNotes('Middle');
    }
    if (baseNotes.length === 0) {
      baseNotes = extractNotes('Base');
    }
    
    // Extract general notes for all fragrances, whether they have specific pyramid notes or not
    let generalNotes = [];
    console.log('Attempting to extract general notes');
      
    try {
      // Method 1: Look for notes in the standard pyramid structure without top/middle/base distinction
      const pyramidDiv = document.getElementById('pyramid');
      if (pyramidDiv) {
        console.log('Found pyramid div, looking for general notes structure');
        
        // Look for the "Fragrance Notes" section
        const fragranceNotesHeading = Array.from(pyramidDiv.querySelectorAll('h3')).find(h =>
          h.textContent.toLowerCase().includes('fragrance notes'));
        
        if (fragranceNotesHeading) {
          console.log('Found Fragrance Notes heading');
          
          // Look for notes in the flex container that follows, which contains the note images and text
          const notesContainer = pyramidDiv.querySelector('div[style*="display: flex"][style*="justify-content: center"][style*="flex-flow: wrap"]');
          
          if (notesContainer) {
            console.log('Found notes container with flex layout');
            
            // Get all note elements - each is in a div with flex-direction: column
            const noteElements = notesContainer.querySelectorAll('div[style*="display: flex"][style*="flex-direction: column"]');
            
            if (noteElements.length > 0) {
              console.log(`Found ${noteElements.length} note elements`);
              
              generalNotes = Array.from(noteElements).map(el => {
                // The note name is in the div that contains the <a> tag
                const textDiv = el.querySelector('div:nth-child(2)');
                return textDiv ? textDiv.textContent.trim() : '';
              }).filter(Boolean);
              
              console.log('Extracted general notes:', generalNotes);
            }
          }
        }
      }
      
      // Method 2: Try to find a heading for general notes if Method 1 didn't work
      if (generalNotes.length === 0) {
        const allHeadings = document.querySelectorAll('h3, h4');
        const notesHeading = Array.from(allHeadings).find(h =>
          h.textContent.toLowerCase().includes('notes') &&
          !h.textContent.toLowerCase().includes('top') &&
          !h.textContent.toLowerCase().includes('middle') &&
          !h.textContent.toLowerCase().includes('base')
        );
        
        if (notesHeading) {
          console.log('Found general notes heading:', notesHeading.textContent);
          
          // Get all links or note elements after this heading until another heading
          const notes = [];
          let current = notesHeading.nextElementSibling;
          
          while (current && !current.tagName.toLowerCase().startsWith('h')) {
            // Try to find note elements
            const noteElements = current.querySelectorAll('a, span.note');
            if (noteElements.length > 0) {
              notes.push(...Array.from(noteElements).map(el => el.textContent.trim()));
            }
            // If no specific note elements found, look for text with commas
            else if (current.textContent.includes(',')) {
              const textNotes = current.textContent.split(',').map(note => note.trim()).filter(Boolean);
              notes.push(...textNotes);
            }
            
            current = current.nextElementSibling;
          }
          
          if (notes.length > 0) {
            generalNotes = notes;
            console.log('Found general notes from heading method:', generalNotes);
          }
        }
      }
      
      // Method 3: Look for any note elements if Methods 1 & 2 didn't work
      if (generalNotes.length === 0) {
        // Look for a notes section without specific headings
        const noteElements = document.querySelectorAll('.notes a, .olfactory-pyramid a, .notes-pyramid a');
        if (noteElements.length > 0) {
          generalNotes = Array.from(noteElements).map(el => el.textContent.trim());
          console.log('Found general notes from generic selectors:', generalNotes);
        }
      }
    } catch (error) {
      console.error('Error extracting general notes:', error);
    }
    
    console.log('Final extracted notes:');
    console.log('Top notes:', topNotes);
    console.log('Middle notes:', middleNotes);
    console.log('Base notes:', baseNotes);
    console.log('General notes:', generalNotes);
    
    // Extract season data where width is at least 80%
    let seasonData = {
      winter: false,
      spring: false,
      summer: false,
      fall: false,
      day: false,
      night: false
    };
    
    try {
      console.log('Attempting to extract season data...');
      
      // Mapping of index attributes to season/time values based on exact HTML structure
      const indexMapping = {
        "0": "winter",
        "1": "spring",
        "2": "summer",
        "3": "fall",
        "4": "day",
        "5": "night"
      };
      
      // Look specifically for the div structure with index attributes
      const indexDivs = document.querySelectorAll('div[index]');
      console.log(`Found ${indexDivs.length} divs with index attributes`);
      
      // Process each div with an index attribute
      indexDivs.forEach(div => {
        const indexValue = div.getAttribute('index');
        console.log(`Processing div with index=${indexValue}`);
        
        // Get the corresponding season/time key
        const seasonKey = indexMapping[indexValue];
        if (!seasonKey) {
          console.log(`No mapping found for index ${indexValue}`);
          return;
        }
        
        console.log(`This corresponds to: ${seasonKey}`);
        
        // Find the inner div containing the bar
        // First find the voting-small-chart-size div
        const chartDiv = div.querySelector('.voting-small-chart-size');
        if (!chartDiv) {
          console.log(`No chart div found for ${seasonKey}`);
          return;
        }
        
        // Then look for the inner width div - it's 2 levels deep
        const barContainer = chartDiv.querySelector('div');
        if (!barContainer) {
          console.log(`No bar container found for ${seasonKey}`);
          return;
        }
        
        const barElement = barContainer.querySelector('div');
        if (!barElement) {
          console.log(`No bar element found for ${seasonKey}`);
          return;
        }
        
        // Extract the width percentage
        const widthStyle = barElement.getAttribute('style');
        console.log(`Width style: ${widthStyle}`);
        
        // Look for percentage values with potential decimal places
        const widthMatch = widthStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
        if (!widthMatch) {
          console.log(`Could not extract width percentage for ${seasonKey}`);
          return;
        }
        
        const widthPercentage = parseFloat(widthMatch[1]);
        console.log(`${seasonKey} width: ${widthPercentage}%`);
        
        // Check if it meets the 80% threshold
        if (widthPercentage >= 80) {
          console.log(`${seasonKey} meets the 80% threshold!`);
          seasonData[seasonKey] = true;
        } else {
          console.log(`${seasonKey} does not meet the 80% threshold`);
        }
      });
      
      // If we didn't find anything by the primary method, try a backup approach
      if (indexDivs.length === 0 || !Object.values(seasonData).some(v => v === true)) {
        console.log('No seasons found with primary method, trying backup approach...');
        
        // This is a backup approach to find the season votes section
        const seasonSection = Array.from(document.querySelectorAll('div.vote-button-bars, div[class*="vote"]')).find(el => {
          // Find section that contains elements with season words
          const text = el.textContent.toLowerCase();
          return text.includes('winter') || text.includes('spring') ||
                 text.includes('summer') || text.includes('fall') ||
                 text.includes('day') || text.includes('night');
        });
        
        if (seasonSection) {
          console.log('Found season section through backup method');
          
          // Find all width bars in this section
          const bars = seasonSection.querySelectorAll('div[style*="width"]');
          console.log(`Found ${bars.length} bar elements in section`);
          
          // Look for divs that include the season names
          const seasonTypes = ['winter', 'spring', 'summer', 'fall', 'day', 'night'];
          
          seasonTypes.forEach(season => {
            // Find the div containing this season's name
            const seasonDiv = Array.from(seasonSection.querySelectorAll('div')).find(div =>
              div.textContent.toLowerCase().includes(season)
            );
            
            if (seasonDiv) {
              console.log(`Found div for ${season}`);
              
              // Find the closest div with a width style
              const barElement = seasonDiv.querySelector('div[style*="width"]') ||
                                seasonDiv.parentElement.querySelector('div[style*="width"]');
                
              if (barElement) {
                const widthStyle = barElement.getAttribute('style');
                const widthMatch = widthStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
                
                if (widthMatch) {
                  const widthPercentage = parseFloat(widthMatch[1]);
                  console.log(`${season} width: ${widthPercentage}%`);
                  
                  if (widthPercentage >= 80) {
                    seasonData[season] = true;
                    console.log(`${season} meets the threshold!`);
                  }
                }
              }
            }
          });
        }
      }
      
      console.log('\n=== Final Season Data ===');
      console.log(JSON.stringify(seasonData, null, 2));
      console.log('Winter:', seasonData.winter);
      console.log('Spring:', seasonData.spring);
      console.log('Summer:', seasonData.summer);
      console.log('Fall:', seasonData.fall);
      console.log('Day:', seasonData.day);
      console.log('Night:', seasonData.night);
    } catch (error) {
      console.error("Error extracting season data:", error);
    }
    
    // Extract perfume image
    const imageUrl = document.querySelector('.max-height-200')?.src || '';
    
    return {
      name, // Still needed as page title in Notion
      mainAccords,
      topNotes,
      middleNotes,
      baseNotes,
      generalNotes, // Add general notes for perfumes without top/middle/base categorization
      imageUrl,
      url: window.location.href,
      seasonData // Add the season data
    };
  } catch (error) {
    console.error("Error extracting perfume data:", error);
    return null;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    const perfumeData = extractPerfumeData();
    sendResponse({ data: perfumeData });
  }
  return true;
});