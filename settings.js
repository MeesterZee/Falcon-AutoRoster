<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let APP_SETTINGS;
  
  // Global flags
  let saveFlag = true; // True if all changes saved, false if unsaved changes
  let busyFlag = false; // True if backup in progress, false if backup not in progress

  window.onload = async function() {
    console.log("Initializing settings...");

    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
      // Show loading indicator
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      // Fetch data in parallel (async not needed but allows for future data streams)
      const [appSettings] = await Promise.all([
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
        })
      ]);

      // Set global variables
      APP_SETTINGS = appSettings;

      // Populate elements with data
      await Promise.all([
        loadSettings(),
      ]);

      setEventListeners(); // Set event listeners last to ensure tables are built before attaching

      console.log("Initialization complete!");

    } catch (error) {
        console.error("Error during initialization: ", error);
    
    } finally {
        // Hide loading indicator and show page
        loadingIndicator.style.display = 'none';
        toolbar.style.display = 'block';
        page.style.display = 'flex';
    }
  };

  function setEventListeners() {
    console.log("Setting event listeners...");
    
    const allTextInputs = document.querySelectorAll('input[type="text"], input[type="color"], .column-input');
    const allSelects = document.querySelectorAll('.table-select, #theme');
    const saveChangesButton = document.getElementById('saveChangesButton');
    const themeSelect = document.getElementById('theme');
    const alertSoundSelect = document.getElementById('alertSound');
    const syncSoundSelect = document.getElementById('syncSound');
    const successSoundSelect = document.getElementById('successSound');
    const classroomSelect = document.getElementById('classroomSelect');
    const ouPathInput = document.getElementById('ouPath');

    window.addEventListener('beforeunload', function (e) {
      if (!saveFlag) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    allTextInputs.forEach(input => {
      input.addEventListener('input', saveAlert);
    });

    allSelects.forEach(select => {
      select.addEventListener('change', saveAlert);
    });

    themeSelect.addEventListener('change', function() {
      const theme = document.getElementById('theme').value;
      const customTheme = document.getElementById('customTheme');

      if (theme === "custom") {
        customTheme.style.display = 'block';
      } else {
        customTheme.style.display = 'none';
      }
    });

    alertSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.alertSound = alertSoundSelect.value
      playNotificationSound("alert");
    });

    syncSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.syncSound = syncSoundSelect.value;
      playNotificationSound("sync");
    });

    successSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.successSound = successSoundSelect.value;
      playNotificationSound("success");
    });

    document.getElementById('silentModeSwitch').addEventListener('change', function() {
      USER_SETTINGS.silentMode = this.checked ? 'true' : 'false';
      saveAlert();
    });

    classroomSelect.addEventListener('change', (event) => {
      const selectedIndex = event.target.value;
      ouPathInput.value = APP_SETTINGS.classroomSettings[selectedIndex].ouPath;
    });

    ouPathInput.addEventListener('input', () => {
      const selectedIndex = classroomSelect.value;
      APP_SETTINGS.classroomSettings[selectedIndex].ouPath = ouPathInput.value;
    });

    saveChangesButton.addEventListener('click', saveSettings);

    console.log("Complete!");
  }

  ///////////////////
  // LOAD SETTINGS //
  ///////////////////
    
  function loadSettings() {
    console.log("Loading settings...");

    // Appearance
    setColorPicker();
    const themeSelect = document.getElementById('theme');
    const customTheme = document.getElementById('customTheme');
    themeSelect.value = USER_SETTINGS.theme;

    if (USER_SETTINGS.theme === "custom") {
      customTheme.style.display = 'block';
    } else {
      customTheme.style.display = 'none';
    }

    // Sound effects
    const silentMode = USER_SETTINGS.silentMode === 'true'; // Convert string to boolean
    document.getElementById('alertSound').value = USER_SETTINGS.alertSound;
    document.getElementById('syncSound').value = USER_SETTINGS.syncSound;
    document.getElementById('successSound').value = USER_SETTINGS.successSound;
    document.getElementById('silentModeSwitch').checked = silentMode; // Use boolean to set switch state

    // School information
    document.getElementById('schoolName').value = APP_SETTINGS.schoolSettings.schoolName || '';
    document.getElementById('schoolYear').value = APP_SETTINGS.schoolSettings.schoolYear || '';
    document.getElementById('domain').value = APP_SETTINGS.schoolSettings.googleDomain || '';

    // School emergency message
    document.getElementById('emergencyMessage').value = APP_SETTINGS.schoolSettings.emergencyMessage || '';

    // Google admin sync
    loadGoogleAdminSync(APP_SETTINGS.classroomSettings);

    // Classroom/teacher information
    loadClassroomSettings(APP_SETTINGS.classroomSettings);
        
    // Emergency group information
    loadEmergencyGroupSettings(APP_SETTINGS.emergencyGroupSettings);

    console.log("Complete!");
  }

  function setColorPicker() {
    const themeTypeSelect = document.getElementById('themeTypeSelect');
    const primaryColorPicker = document.getElementById('primaryColorPicker');
    const accentColorPicker = document.getElementById('accentColorPicker');

    themeTypeSelect.value = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim();
    primaryColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    accentColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
  }

  function loadGoogleAdminSync(syncSettings) {
    const select = document.getElementById('classroomSelect');
    const ouPathInput = document.getElementById('ouPath');
    
    // Create document fragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Filter and map in a single pass
    const validSettings = syncSettings.reduce((acc, setting, index) => {
      const { classroom, teacher, ouPath } = setting;
      
      if (classroom || teacher) {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = [classroom, teacher].filter(Boolean).join(' - ');
        fragment.appendChild(option);
        acc.push(ouPath);
      }
      return acc;
    }, []);

    // Batch DOM operations
    select.innerHTML = '';
    select.appendChild(fragment);
    select.selectedIndex = 0;
    
    // Set initial OU path if available
    ouPathInput.value = validSettings[0] || '';
  }

  function loadClassroomSettings(classroomSettings) {
    const tableRows = document.querySelectorAll('#classroomSettings tbody tr');

    // Iterate over each row and populate columns 2 and 3 with data from classroomSettings
    tableRows.forEach((row, index) => {
      const classroomData = classroomSettings[index] || {};

      // Column 2: Classroom
      const classroomInput = row.querySelector('td:nth-child(2) input');
      classroomInput.value = classroomData.classroom || '';

      // Column 3: Teacher
      const teacherInput = row.querySelector('td:nth-child(3) input');
      teacherInput.value = classroomData.teacher || '';
    });
  }

  function loadEmergencyGroupSettings(emergencyGroupSettings) {
    const tableRows = document.querySelectorAll('#emergencyGroupSettings tbody tr');

    // Iterate over each row and populate columns 2 and 3 with data from classroomSettings
    tableRows.forEach((row, index) => {
      const emergencyGroupData = emergencyGroupSettings[index] || {};
      
      // Column 1: Range
      const rangeInput = row.querySelector('td:nth-child(1) input');
      rangeInput.value = emergencyGroupData.range || '';

      // Column 2: Group
      const groupInput = row.querySelector('td:nth-child(2) input');
      groupInput.value = emergencyGroupData.group || '';

      // Column 3: Color
      const colorInput = row.querySelector('td:nth-child(3) input');
      colorInput.value = emergencyGroupData.color || '#ffffff';
    });
  }

  ///////////////////
  // SAVE SETTINGS //
  ///////////////////

  function saveSettings() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      busyFlag = false;
      return;
    }
    
    showToast("", "Saving changes...", 5000);
    busyFlag = true;
    
    appSettings = getAppSettings();
    userSettings = getUserSettings();

    google.script.run
      .withSuccessHandler(() => {
        APP_SETTINGS = appSettings; // Save to global settings
        USER_SETTINGS = userSettings; // Save to global user settings

        // Update the UI
        setTheme();
        setColorPicker();
        loadGoogleAdminSync(APP_SETTINGS.classroomSettings);
    
        saveChangesButton.classList.remove('tool-bar-button-unsaved');
        playNotificationSound("success");
        showToast("", "Settings saved!", 5000);
        saveFlag = true;
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        } else {
          showError("Error: SAVE_FAILURE");
        }
        
        saveFlag = false;
        busyFlag = false;
      })
    .writeSettings(userSettings, appSettings);
  }

  function getUserSettings() {
    const theme = document.getElementById('theme').value;
    let customThemeType;
    let customThemePrimaryColor;
    let customThemeAccentColor;

    if (theme === 'custom') {
      customThemeType = document.getElementById('themeTypeSelect').value;
      customThemePrimaryColor = document.getElementById('primaryColorPicker').value;
      customThemeAccentColor = document.getElementById('accentColorPicker').value;
    } else {
      customThemeType = '';
      customThemePrimaryColor = '';
      customThemeAccentColor = '';
    }
    
    return {
      theme: theme,
      customThemeType: customThemeType, 
      customThemePrimaryColor: customThemePrimaryColor,
      customThemeAccentColor: customThemeAccentColor,
      alertSound: document.getElementById('alertSound').value,
      syncSound: document.getElementById('syncSound').value,
      successSound: document.getElementById('successSound').value,
      silentMode: document.getElementById('silentModeSwitch').checked ? 'true' : 'false'
    };
  }

  function getAppSettings() {
    // Get school settings    
    const schoolSettings = {
      schoolYear: document.getElementById('schoolYear').value,
      schoolName: document.getElementById('schoolName').value,
      googleDomain: document.getElementById('domain').value,
      emergencyMessage: document.getElementById('emergencyMessage').value,
    };

    // Retrieve classroom settings from the table
    const classroomSettings = [];
    const classroomTableBody = document.querySelector('#classroomSettings tbody');
    classroomTableBody.querySelectorAll('tr').forEach((row) => {
      const grade = row.querySelector('td:nth-child(1)').textContent || '';
      const classroom = row.querySelector('td:nth-child(2) input').value || '';
      const teacher = row.querySelector('td:nth-child(3) input').value || '';

      // Find matching ouPath from APP_SETTINGS, or use a default value
      const matchingClassroom = APP_SETTINGS.classroomSettings.find(
        (entry) => entry.classroom === classroom
      );
      const ouPath = matchingClassroom ? matchingClassroom.ouPath : '';

      classroomSettings.push({ grade, classroom, teacher, ouPath });
    });

    // Get emergency group settings
    const emergencyGroupSettings = [];
    const emergencyGroupTableBody = document.querySelector('#emergencyGroupSettings tbody');
    emergencyGroupTableBody.querySelectorAll('tr').forEach((row) => {
      emergencyGroupSettings.push({
        range: row.querySelector('td:nth-child(1) input').value || '',
        group: row.querySelector('td:nth-child(2) input').value || '',
        color: row.querySelector('td:nth-child(3) input').value || '#ffffff',
      });
    });

    return {
      schoolSettings,
      classroomSettings,
      emergencyGroupSettings,
    };
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  function showError(errorType, callback = "") {
    const warningIcon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>`;
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "Error: OPERATION_IN_PROGRESS":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;

      case "Error: SAVE_FAILURE":
        title = errorIcon + "Save Error";
        message = "An unknown error occurred while saving the settings. The operation could not be completed.";
        button1 = "Close";
        break;

      default:
        title = errorIcon + "Error";
        message = errorType;
        button1 = "Close";
        break;
    }

    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
  
  async function sessionError() {
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    const title = `${errorIcon}Session Expired`;
    const message = "The current session has expired. Please sign in with Google and try again.";
    
    playNotificationSound("alert");
    const buttonText = await showModal(title, message, "Cancel", "Sign in");
       
    if (buttonText === "Sign in") {
      const signInUrl = "https://accounts.google.com";
      const signInTab = window.open(signInUrl, "_blank");
    }
  }
  
  function saveAlert() {
    saveFlag = false;
    saveChangesButton.classList.add('tool-bar-button-unsaved');
  }
  </script>
