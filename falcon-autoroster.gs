/** Falcon AutoRoster - Web App v7.1.1 **/
/** Falcon EDU © 2023-2025 All Rights Reserved **/
/** Created by: Nick Zagorin **/

//////////////////////
// GLOBAL CONSTANTS //
//////////////////////

const SCHOOL_DATA_SHEET = SpreadsheetApp.getActive().getSheetByName('School Data');

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

  return HtmlService.createHtmlOutput(htmlTemplate.evaluate().getContent())
    .setContent(htmlTemplate.evaluate().getContent().replace("{{NAVBAR}}", getNavbar(page)))
    .setFaviconUrl("https://meesterzee.github.io/FalconEDU/images/Falcon%20EDU%20Favicon%2032x32.png")
    .setTitle("Falcon AutoRoster");
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
        const message = "<b>Web App Version:</b> 7.1.1<br><b>Build:</b> 33.080825 <br><br>© 2023-2026 - All rights reserved";
        showAlertModal(title, message, "Close");
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
  
  // Return empty array if there are no data rows
  if (lastRow <= 1) {
    return [];
  }

  // Get all headers and data in just two API calls
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  
  // Map the data to objects using array methods
  const studentData = data.map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });

  return studentData;
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
    syncSound: userProperties.getProperty('syncSound') || 'sync01',
    successSound: userProperties.getProperty('successSound') || 'success01',
    silentMode: userProperties.getProperty('silentMode') || 'false'
  };
}

/** Get app settings from script properties service */
function getAppSettings() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentYear = new Date().getFullYear();

  const properties = {
    // School settings
    schoolSettings: {
      schoolName: scriptProperties.getProperty('schoolName') || "",
      schoolYear: scriptProperties.getProperty('schoolYear') || (currentYear + '-' + (currentYear + 1)),
      googleDomain: scriptProperties.getProperty('googleDomain') || "",
      lastSync: scriptProperties.getProperty('lastSync') || "",
      emergencyMessage: scriptProperties.getProperty('emergencyMessage') || ""
    },
    
    // Classroom settings
    classroomSettings: scriptProperties.getProperty('classroomSettings') ? JSON.parse(scriptProperties.getProperty('classroomSettings')) : [],
    
    // Emergency group settings
    emergencyGroupSettings: scriptProperties.getProperty('emergencyGroupSettings') ? JSON.parse(scriptProperties.getProperty('emergencyGroupSettings')) : []
  };

  return properties;
}

function writeSettings(userSettings, appSettings) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const scriptProperties = PropertiesService.getScriptProperties();
    
    // Store user-specific settings in User Properties and delete unused properties
    userProperties.setProperties({
      theme: userSettings.theme || 'falconLight',
      customThemeType: userSettings.customThemeType || '',
      customThemePrimaryColor: userSettings.customThemePrimaryColor || '',
      customThemeAccentColor: userSettings.customThemeAccentColor || '',
      alertSound: userSettings.alertSound || 'alert01',
      syncSound: userSettings.syncSound || 'sync01',
      successSound: userSettings.successSound || 'success01',
      silentMode: userSettings.silentMode || 'false'
    }, true);
  
    // Store app-wide settings in Script Properties and delete unused properties
    scriptProperties.setProperties({
      lastSync: scriptProperties.getProperty('lastSync') || '', // Retain property from sync
      
      // School settings      
      schoolName: appSettings.schoolSettings.schoolName,
      schoolYear: appSettings.schoolSettings.schoolYear,
      googleDomain: appSettings.schoolSettings.googleDomain,
      emergencyMessage: appSettings.schoolSettings.emergencyMessage,
      
      // Classroom settings
      classroomSettings: JSON.stringify(appSettings.classroomSettings),
      
      // Emergency settings
      emergencyGroupSettings: JSON.stringify(appSettings.emergencyGroupSettings)
    }, true);
  } catch (e) {
    throw new Error(e);
  }
}

////////////////////
// SYNC FUNCTIONS //
////////////////////

/** Sync data with the Google Admin directory */
function syncAdminDirectory() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const props = scriptProperties.getProperties(); // Batch get all properties
  const googleDomain = props.googleDomain;
  const classroomSettings = props.classroomSettings ? JSON.parse(props.classroomSettings) : [];
  const emergencyGroupSettings = props.emergencyGroupSettings ? JSON.parse(props.emergencyGroupSettings) : [];
  
  // Validate required settings
  if (!googleDomain || !classroomSettings.length || !emergencyGroupSettings.length) {
    throw new Error(`Error: ${[
      !googleDomain && 'MISSING_DOMAIN',
      !classroomSettings.length && 'MISSING_CLASSROOMS',
      !emergencyGroupSettings.length && 'MISSING_EMERGENCY_GROUPS'
    ].filter(Boolean).join(', ')}`);
  }

  try {
    // Pre-process emergency group ranges for faster lookup
    const emergencyRanges = emergencyGroupSettings.map(setting => ({
      ...setting,
      start: setting.range.split('-')[0],
      end: setting.range.split('-')[1] || 'ZZZZ'
    }));

    // Create OU path lookup map
    const orgUnitMappings = new Map(
      classroomSettings.map(setting => [
        setting.ouPath,
        { ...setting, students: 0 }
      ])
    );

    const studentData = [];
    let pageToken;
    
    // Batch process users in chunks
    do {
      const response = AdminDirectory.Users.list({
        domain: googleDomain,
        type: 'all',
        maxResults: 500, // Increased for fewer API calls
        orderBy: 'familyName',
        pageToken
      });

      if (!response.users) break;

      // Process users in batch
      response.users.forEach(user => {
        const orgUnitInfo = orgUnitMappings.get(user.orgUnitPath);
        if (!orgUnitInfo) return;

        const lastName = user.name.familyName;
        
        // Find student's emergency group
        const emergencyGroup = findEmergencyGroup(lastName.trim().toUpperCase(), emergencyRanges);

        studentData.push([
          lastName,
          user.name.givenName,
          orgUnitInfo.grade,
          orgUnitInfo.classroom,
          orgUnitInfo.teacher,
          emergencyGroup,
          orgUnitInfo.ouPath
        ]);

        orgUnitInfo.students++;
      });

      pageToken = response.nextPageToken;
    } while (pageToken);

    // Update script properties
    scriptProperties.setProperties({
      lastSync: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      classroomSettings: JSON.stringify(Array.from(orgUnitMappings.values()))
    });
    
    writeStudentData(studentData);

    return true;
  } catch (error) {
    if (error.message.includes ("Not Authorized")) {
      throw ('Error: PERMISSION');
    } else {
      throw ('Error: SYNC_FAILURE');
    }
  }
}

/** Optimized binary search for emergency group assignment */
function findEmergencyGroup(lastName, emergencyGroupRanges) {
  const firstLetter = lastName[0].toUpperCase();  // Get the first letter of the last name

  for (const range of emergencyGroupRanges) {
    // Extract the start and end letters from the range
    const [startLetter, endLetter] = range.range.split('-');

    // Check if the first letter of the last name is within the range
    if (firstLetter >= startLetter && firstLetter <= endLetter) {
      return range.group;
    }
  }
  return "";
}

/** Write the data from the Google Admin directory to the 'Student Data' sheet */
function writeStudentData(studentData) {
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

////////////////////
// FILE FUNCTIONS //
////////////////////

function getCsv() {
  try {
    const data = SCHOOL_DATA_SHEET.getDataRange().getDisplayValues();

    return data.map(rowArray => {
      return rowArray.map(field => {
        // Convert to string and trim any whitespace
        let stringField = String(field).trim();
        
        // Determine if the field needs to be quoted
        let needsQuoting = false;
        
        // Quote if: contains commas, quotes, line breaks, or is a number with leading zeros
        if (
          stringField.includes(',') || 
          stringField.includes('"') || 
          stringField.includes('\n') || 
          stringField.includes('\r') ||
          (
            // Check for leading zeros in numeric fields
            /^0\d+$/.test(stringField) && 
            !isNaN(stringField)
          )
        ) {
          needsQuoting = true;
        }

        if (needsQuoting) {
          // Escape any existing quotes by doubling them
          stringField = stringField.replace(/"/g, '""');
          // Wrap the field in quotes
          return `"${stringField}"`;
        }
        
        return stringField;
      }).join(',');
    }).join('\r\n');
  } catch(e) {
      throw new Error('Error: EXPORT_FAILURE');
  }
}

/** Export data as a .xlsx file **/
function getXlsx() {
  try {
    const spreadsheetId = SpreadsheetApp.getActive().getId();
    const sheetId = SCHOOL_DATA_SHEET.getSheetId();
    
    // Construct the export URL
    const url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=xlsx&gid=" + sheetId;
    
    // Fetch the xlsx file as a blob
    const blob = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}}).getBlob();
    
    // Return blob as binary
    return blob.getBytes();
  } catch(e) {
      throw new Error('Error: EXPORT_FAILURE');
  }
}
