/** Falcon AutoRoster - Web App v5.9.2 **/
/** Falcon EDU © 2023-2025 All Rights Reserved **/
/** Created by: Nick Zagorin **/

//////////////////////
// GLOBAL CONSTANTS //
//////////////////////

const SCHOOL_DATA_SHEET = SpreadsheetApp.getActive().getSheetByName('School Data');
const CONSOLE_SHEET = SpreadsheetApp.getActive().getSheetByName('Console');

///////////////////////////
// PAGE RENDER FUNCTIONS //
///////////////////////////

/** Render the web app in the browser **/
function doGet(e) {
  const userSettings = getUserProperties();
  const page = e.parameter.page || "dashboard";
  const htmlTemplate = HtmlService.createTemplateFromFile(page);

  // Inject the user properties into the HTML
  htmlTemplate.userSettings = JSON.stringify(userSettings);
  
  // Evaluate and prepare the HTML content
  const htmlContent = htmlTemplate.evaluate().getContent();
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent);

  //Replace {{NAVBAR}} in HTML with the navigation bar content
  htmlOutput.setContent(htmlOutput.getContent().replace("{{NAVBAR}}",getNavbar(page)));
  
  // Set the tab favicon
  htmlOutput.setFaviconUrl("https://meesterzee.github.io/FalconEDU/images/Falcon%20EDU%20Favicon%2032x32.png");
  
  // Set the tab title
  htmlOutput.setTitle("Falcon AutoRoster");
  
  return htmlOutput;
}

/** Get web app navigation/menu bar **/
function getNavbar(activePage) {
  const dashboardURL = getScriptURL();
  const settingsURL = getScriptURL("page=settings");
  const headerText = "Falcon AutoRoster";

  let navbar = 
    `<div class="menu-bar">
      <button class="menu-button" onclick="showNav()">
        <div id="menu-icon">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      <h1 id="header-text">` + headerText + `</h1>
    </div>
    <div class="nav-bar" id="nav-bar-links">
      <a href="${dashboardURL}" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
        <i class="bi bi-person-circle"></i>Dashboard
      </a>
      <a href="${settingsURL}" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
        <i class="bi bi-gear-wide-connected"></i>Settings
      </a>
      <button class="nav-button" onclick="showAbout()">
        <i class="bi bi-info-circle"></i>About
      </button>
    </div>
    <div class="javascript-code">
    <script>
      function showNav() {
        const icon = document.getElementById('menu-icon');
        const navbar = document.querySelector('.nav-bar');
        icon.classList.toggle('open');
        navbar.classList.toggle('show');
      }

      function showAbout() {
        const title = "<i class='bi bi-info-circle'></i>About Falcon AutoRoster";
        const message = "Web App Version: 5.9.2<br>Build: 16100124 <br><br>Created by: Nick Zagorin<br>© 2023-2025 - All rights reserved";
        showModal(title, message, "Close");
      }
    </script>
    </div>`;

  return navbar;
}

/** Get URL of the Google Apps Script web app **/
function getScriptURL(qs = null) {
  let url = ScriptApp.getService().getUrl();
  if(qs){
    if (qs.indexOf("?") === -1) {
      qs = "?" + qs;
    }
    url = url + qs;
  }

  return url;
}

/** Include additional files in HTML **/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

////////////////////
// DATA FUNCTIONS //
////////////////////

/** Get school data from 'School Data' sheet */
function getSchoolData() {
  const sheet = SCHOOL_DATA_SHEET;
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return []; // No data rows
  }

  const numRows = lastRow - 1;
  const numColumns = sheet.getLastColumn();
  
  // Get all data at once
  const dataRange = sheet.getRange(2, 1, numRows, numColumns);
  const data = dataRange.getValues(); // This gives a 2D array of all values
  
  // Get headers
  const headers = sheet.getRange(1, 1, 1, numColumns).getValues()[0];
  
  // Transform data into objects using map function
  const objects = data.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index]; // Use the corresponding row data
    });
    return obj;
  });

  return objects;
}

/** Get user settings from user properties service **/
function getUserProperties() {
  const userProperties = PropertiesService.getUserProperties();

  return {
    theme: userProperties.getProperty('theme') || 'falconLight',
    customThemeType: userProperties.getProperty('customThemeType'),
    customThemePrimaryColor: userProperties.getProperty('customThemePrimaryColor'),
    customThemeAccentColor: userProperties.getProperty('customThemeAccentColor'),
    alertSound: userProperties.getProperty('alertSound') || 'alert01',
    successSound: userProperties.getProperty('successSound') || 'success01',
    syncSound: userProperties.getProperty('syncSound') || 'sync01',
    silentMode: userProperties.getProperty('silentMode') || 'false'
  };
}

/** Get school settings from 'Console' sheet **/
function getSchoolSettings() {
  const data = CONSOLE_SHEET.getRange('A3:E3').getDisplayValues().flat();
  
  const schoolSettings = {
    'School Name': data[0],
    'School Year': data[1],
    'Google Domain': data[2],
    'Total Students': data[3],
    'Last Sync': data[4]
  };
  
  return schoolSettings;
}

/** Get classroom settings from 'Console' sheet*/
function getClassroomSettings() {
  const dataRange = CONSOLE_SHEET.getRange('A5:E24').getValues();
  
  // Assuming the first row in the dataRange contains headers
  const headers = dataRange[0];
  
  // Array to hold the objects
  const classroomSettings = [];
  
  // Iterate over the rows, starting from the second row (index 1)
  for (let i = 1; i < dataRange.length; i++) {
    let row = dataRange[i];
    let classroomSetting = {};
    
    // Populate the object with key-value pairs
    for (let j = 0; j < headers.length; j++) {
      classroomSetting[headers[j]] = row[j];
    }
    
    // Add the object to the array
    classroomSettings.push(classroomSetting);
  }
  
  return classroomSettings;
}

/** Get emergency settings from 'Console' sheet*/
function getEmergencySettings() {
  const dataRange = CONSOLE_SHEET.getRange('A26:C34').getValues();
  
  // Assuming the first row in the dataRange contains headers
  const headers = dataRange[0];
  
  // Array to hold the objects
  const emergencySettings = [];
  
  // Iterate over the rows, starting from the second row (index 1)
  for (let i = 1; i < dataRange.length; i++) {
    let row = dataRange[i];
    let emergencySetting = {};
    
    // Populate the object with key-value pairs
    for (let j = 0; j < headers.length; j++) {
      emergencySetting[headers[j]] = row[j];
    }
    
    // Add the object to the array
    emergencySettings.push(emergencySetting);
  }
  
  // Additional data
  const emergencyMessageSetting = {
    'Message': CONSOLE_SHEET.getRange('D27').getValue()
  };

  // Add additional settings as a separate entry in the array
  emergencySettings.push(emergencyMessageSetting);

  // Return or use the classroomSettings array as needed
  return emergencySettings;
}

/** Get the emergency group based on last name */
function getEmergencyGroup(lastName, emergencySettings) {
  let emergencyGroup = '';

  emergencySettings.forEach(emergency => {
    const range = emergency['Group Range'];

    // Check if range is defined and not empty
    if (range && typeof range === 'string') {
      const [start, end] = range.split('-');
      const lastNameFirstChar = lastName.charAt(0).toUpperCase();

      if (lastNameFirstChar >= start && lastNameFirstChar <= end) {
        emergencyGroup = emergency['Group Name'];
      }
    }
  });

  return emergencyGroup;
}

////////////////////
// SYNC FUNCTIONS //
////////////////////

/** Sync data with the Google Admin directory */
function syncAdminDirectory() {
  try {
    const schoolDomain = CONSOLE_SHEET.getRange('C3').getDisplayValue();

    // Check for a domain
    if (!schoolDomain) {
      return "missingDomain";
    }

    const options = {
      domain: schoolDomain, // Google Workspace domain name
      type: 'all',
      maxResults: 100,
      orderBy: 'familyName',
      pageToken: null // Initialize pageToken
    };

    let studentData = [];
    const classroomSettings = getClassroomSettings();
    const emergencySettings = getEmergencySettings();

    // Check for classrooms and emergency groups
    if (!classroomSettings.length) {
      return "missingClassrooms"
    }
    if (!emergencySettings.length) {
      return "missingEmergencyGroups"
    }

    // Initialize student count to 0 for each setting
    classroomSettings.forEach(setting => {
      setting['Students'] = 0;
    });

    // Create a mapping from 'Google OU Path' to classroom settings
    const orgUnitMappings = {};
    classroomSettings.forEach(setting => {
      orgUnitMappings[setting['Google OU Path']] = setting;
    });

    do {
      const response = AdminDirectory.Users.list(options);

      response.users.forEach(function (user) {
        const orgUnitInfo = orgUnitMappings[user.orgUnitPath];

        if (orgUnitInfo) {
          // Determine emergency group based on last name
          const lastName = user.name.familyName;
          const emergencyGroup = getEmergencyGroup(lastName, emergencySettings);

          studentData.push([
            lastName,
            user.name.givenName,
            orgUnitInfo['Grade'],
            orgUnitInfo['Classroom'],
            orgUnitInfo['Teacher'],
            emergencyGroup,
            orgUnitInfo['Google OU Path']
          ]);

          // Update the classroom count directly in classroomSettings
          orgUnitInfo['Students']++;
        }
      });

      options.pageToken = response.nextPageToken;
    } while (options.pageToken);
    
    writeSchoolData(studentData);
    writeClassroomCounts(classroomSettings);

    // Update the last sync time on the 'Console' sheet
    const lastSync = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    CONSOLE_SHEET.getRange('E3').setValue(lastSync);

  } catch (error) {
    return "syncFailure";
  }
}

/** Write the data from the Google Admin directory to the 'School Data' sheet */
function writeSchoolData(studentData) {
  // Define the header row
  const headerRow = ['Last Name', 'First Name', 'Grade', 'Classroom', 'Teacher', 'Emergency Group', 'Google OU Path'];

  // Add the header row at the beginning of the studentData array
  studentData.sort();
  studentData.unshift(headerRow);

  const numRows = studentData.length;
  const numColumns = studentData[0].length;
  
  SCHOOL_DATA_SHEET.clearContents();
  
  // Set the range to include the header row
  SCHOOL_DATA_SHEET.getRange(1, 1, numRows, numColumns).setValues(studentData);

  // Delete any excess rows in the 'School Data' sheet
  if (SCHOOL_DATA_SHEET.getMaxRows() > numRows) {
    SCHOOL_DATA_SHEET.deleteRows(numRows + 1, SCHOOL_DATA_SHEET.getMaxRows() - numRows);
  }
}

function writeClassroomCounts(classroomSettings) {
  const startRow = 6;
  const startColumn = 1;
  const numRows = classroomSettings.length;
  const numColumns = 4; // We are interested in columns A to D

  const data = classroomSettings.map(setting => [
    setting['Grade'],
    setting['Classroom'],
    setting['Teacher'],
    setting['Students']
  ]);

  CONSOLE_SHEET.getRange(startRow, startColumn, numRows, numColumns).setValues(data);
}

function writeSettings(userSettings, schoolSettings, classroomSettings, emergencyMessage, emergencySettings) {
  const userProperties = PropertiesService.getUserProperties();
  const properties = {
    theme: userSettings.theme,
    customThemeType: userSettings.customThemeType,
    customThemePrimaryColor: userSettings.customThemePrimaryColor,
    customThemeAccentColor: userSettings.customThemeAccentColor,
    alertSound: userSettings.alertSound,
    successSound: userSettings.successSound,
    syncSound: userSettings.syncSound,
    silentMode: userSettings.silentMode
  };

  // Sets multiple user properties at once while deleting all other user properties to maintain store
  userProperties.setProperties(properties, true); 

  // Write global settings to the 'Console' sheet
  CONSOLE_SHEET.getRange('A3:C3').setValues(schoolSettings);
  CONSOLE_SHEET.getRange('B6:E24').setValues(classroomSettings);
  CONSOLE_SHEET.getRange('D27').setValues(emergencyMessage);
  CONSOLE_SHEET.getRange('A27:C34').setValues(emergencySettings);
}

////////////////////
// FILE FUNCTIONS //
////////////////////

/** Export data as a .csv file **/
function getCsv() {
  const data = SCHOOL_DATA_SHEET.getDataRange().getValues();
  let csvContent = '';
  
  data.forEach(function(rowArray) {
    var row = rowArray.join(',');
    csvContent += row + '\r\n';
  });
  
  return csvContent;
}

/** Export data as a .xlsx file **/
function getXlsx() {
  const spreadsheetId = SpreadsheetApp.getActive().getId();
  const sheetId = SCHOOL_DATA_SHEET.getSheetId();
  
  // Construct the export URL
  const url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=xlsx&gid=" + sheetId;
  
  // Fetch the xlsx file as a blob
  const blob = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}}).getBlob();
  
  return blob.getBytes();
}
