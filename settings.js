<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let SCHOOL_SETTINGS;
  let CLASSROOM_SETTINGS;
  let EMERGENCY_SETTINGS;
  
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

      // Fetch initial data
      const [schoolSettings, classroomSettings, emergencySettings] = await Promise.all([
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getSchoolSettings();
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getClassroomSettings();
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getEmergencySettings();
        })
      ]);

      // Set global variables
      SCHOOL_SETTINGS = schoolSettings;
      CLASSROOM_SETTINGS = classroomSettings;
      EMERGENCY_SETTINGS = emergencySettings;

      // Populate elements with data
      await Promise.all([
        setColorPicker(),
        loadSettings(),
        populateGoogleAdminSync(),
        populateClassroomTeacher(),
        populateEmergencyGroups()
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
      USER_SETTINGS.alertSound = alertSoundSelect.value;
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

    document.getElementById('silentModeSwitch').addEventListener('change', saveAlert);

    classroomSelect.addEventListener('change', (event) => {
      const selectedIndex = event.target.value;
      ouPathInput.value = CLASSROOM_SETTINGS[selectedIndex]['Google OU Path'];
    });

    // Event listener for changing the OU Path input
      ouPathInput.addEventListener('input', () => {
        const selectedIndex = classroomSelect.value;
        CLASSROOM_SETTINGS[selectedIndex]['Google OU Path'] = ouPathInput.value;
      });

    saveChangesButton.addEventListener('click', saveSettings);

    console.log("Complete!");
  }

  function setColorPicker() {
    const themeType = document.getElementById('themeTypeSelect');
    const primaryColorPicker = document.getElementById('primaryColorPicker');
    const accentColorPicker = document.getElementById('accentColorPicker');

    themeTypeSelect.value = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim();
    primaryColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    accentColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
  }

  ///////////////////
  // LOAD SETTINGS //
  ///////////////////
    
  function loadSettings() {
    console.log("Loading settings...");

    // Appearance
    const themeSelect = document.getElementById('theme');
    const customTheme = document.getElementById('customTheme');

    if (USER_SETTINGS.theme === "custom") {
      customTheme.style.display = 'block';
    } else {
      customTheme.style.display = 'none';
    }

    themeSelect.value = USER_SETTINGS.theme;

    // Sound Effects
    const silentModeChecked = USER_SETTINGS.silentMode === 'true'; // Convert string to boolean
    document.getElementById('silentModeSwitch').checked = silentModeChecked;
    document.getElementById('alertSound').value = USER_SETTINGS.alertSound;
    document.getElementById('syncSound').value = USER_SETTINGS.syncSound;
    document.getElementById('successSound').value = USER_SETTINGS.successSound;

    // School Information
    document.getElementById('schoolName').value = SCHOOL_SETTINGS['School Name'];
    document.getElementById('schoolYear').value = SCHOOL_SETTINGS['School Year'];
    document.getElementById('domain').value = SCHOOL_SETTINGS['Google Domain'];
        
    // Emergency Message
    const message = (EMERGENCY_SETTINGS.find(obj => obj['Message']) || {})['Message'];
    document.getElementById('emergencyMessage').value = message;

    console.log("Complete!");
  }

  function populateGoogleAdminSync() {
    const select = document.getElementById('classroomSelect');
    select.innerHTML = '';

    // Clear the OU path input initially
    const ouPathInput = document.getElementById('ouPath');
    ouPathInput.value = '';

    // Create an array to hold the OU paths for valid options
    const validOUPaths = [];

    // Populate the Google Admin classroom select box
    CLASSROOM_SETTINGS.forEach((setting, index) => {
      const classroomValue = setting['Classroom'];
      const teacherValue = setting['Teacher'];

      if (classroomValue || teacherValue) {
        const option = document.createElement('option');
        option.value = index;

        if (classroomValue && teacherValue) {
          option.textContent = `${classroomValue} - ${teacherValue}`;
        } else if (classroomValue) {
          option.textContent = classroomValue;
        } else {
          option.textContent = teacherValue;
        }

        select.appendChild(option);
        // Add the corresponding OU path to the validOUPaths array
        validOUPaths.push(setting['Google OU Path']);
      }
    });

    // Set the default selected classroom
    select.selectedIndex = 0;

    // Update the OU path input based on the initial selection
    if (validOUPaths.length > 0) {
      ouPathInput.value = validOUPaths[0];
    }
  }

  function populateClassroomTeacher() {
    const tableBody = document.querySelector('#classroomSettings tbody');
    tableBody.innerHTML = '';

    CLASSROOM_SETTINGS.forEach((classroom, rowIndex) => {
      const row = document.createElement('tr');

      // Create cells for each classroom property
      const gradeCell = document.createElement('td');
      gradeCell.textContent = classroom['Grade'];

      const classroomCell = document.createElement('td');
      const classroomInput = document.createElement('input');
      classroomInput.className = 'table-input';
      classroomInput.type = 'text';
      classroomInput.id = `classroom-input-${rowIndex}`;
      classroomInput.value = classroom['Classroom'];
      classroomCell.appendChild(classroomInput);

      const teacherCell = document.createElement('td');
      const teacherInput = document.createElement('input');
      teacherInput.className = 'table-input';
      teacherInput.type = 'text';
      teacherInput.id = `teacher-input-${rowIndex}`;
      teacherInput.value = classroom['Teacher'];
      teacherCell.appendChild(teacherInput);
    
      // Append cells to the row
      row.appendChild(gradeCell);
      row.appendChild(classroomCell);
      row.appendChild(teacherCell);

      // Append row to the table body
      tableBody.appendChild(row);
    });

  }

  function populateEmergencyGroups() {
    const tableBody = document.querySelector('#emergencyGroups tbody');
    tableBody.innerHTML = '';

    EMERGENCY_SETTINGS.forEach((group, rowIndex) => {
      // Skip objects that have the 'Message' property
      if (group.hasOwnProperty('Message')) {
        return;
      }
      
      const row = document.createElement('tr');

      // Create cells for each classroom property
      const groupRangeCell = document.createElement('td');
      const groupRangeInput = document.createElement('input');
      groupRangeInput.className = 'table-input';
      groupRangeInput.type = 'text';
      groupRangeInput.id = `groupRange-input-${rowIndex}`;
      groupRangeInput.value = group['Group Range'];
      groupRangeCell.appendChild(groupRangeInput);

      const groupNameCell = document.createElement('td');
      const groupNameInput = document.createElement('input');
      groupNameInput.className = 'table-input';
      groupNameInput.type = 'text';
      groupNameInput.id = `groupName-input-${rowIndex}`;
      groupNameInput.value = group['Group Name'];
      groupNameCell.appendChild(groupNameInput);

      const colorCell = document.createElement('td');
      const colorInput = document.createElement('input');
      colorInput.className = 'table-input';
      colorInput.type = 'color';
      colorInput.id = `color-input-${rowIndex}`;
      colorInput.value = group['Color Hex'];
      colorCell.appendChild(colorInput);

      // Append cells to the row
      row.appendChild(groupRangeCell);
      row.appendChild(groupNameCell);
      row.appendChild(colorCell);
      
      
      // Append row to the table body
      tableBody.appendChild(row);
    });
  }

  ///////////////////
  // SAVE SETTINGS //
  ///////////////////

  function saveSettings() {
    if (busyFlag) {
      showError("operationInProgress");
      busyFlag = false;
      return;
    }
    
    busyFlag = true;
    saveChangesButton.classList.remove('tool-bar-button-unsaved');

    // Get appearance
    const themeSetting = document.getElementById('theme').value;
    saveTheme();
    setColorPicker();
    
    // Get sound effects
    saveSound();
    
    // Get school information
    const schoolName = document.getElementById('schoolName').value;
    const schoolYear = document.getElementById('schoolYear').value;
    const domain = [[document.getElementById('domain').value]];
    const schoolSettings = [[schoolName, schoolYear, domain]];

    // Get classroom settings
    const classroomSettings = getClassroomSettings();

    // Get emergency settings
    const emergencyMessage = [[document.getElementById('emergencyMessage').value]];
    const emergencySettings = getEmergencySettings();

    // Update the Google admin sync selects
    populateGoogleAdminSync();

    // Update the page header
    saveFlag = true;
    playNotificationSound("success");
    showToast("", "Settings saved!", 5000);
    
    google.script.run.writeSettings(USER_SETTINGS, schoolSettings, classroomSettings, emergencyMessage, emergencySettings);

    busyFlag = false;
  }

  function getClassroomSettings() {
    const tableBody = document.querySelector('#classroomSettings tbody');
    const rows = tableBody.querySelectorAll('tr');
    const classroomSettings = [];

    rows.forEach((row, rowIndex) => {
      const classroom = row.querySelector(`#classroom-input-${rowIndex}`).value;
      const teacher = row.querySelector(`#teacher-input-${rowIndex}`).value;

      // Update CLASSROOM_SETTINGS
      if (classroom || teacher) {
        if (CLASSROOM_SETTINGS[rowIndex]) {
          CLASSROOM_SETTINGS[rowIndex]['Classroom'] = classroom;
          CLASSROOM_SETTINGS[rowIndex]['Teacher'] = teacher;
        }

        // Push the values as an array
        classroomSettings.push([
          classroom, 
          teacher, 
          CLASSROOM_SETTINGS[rowIndex]['Students'],
          CLASSROOM_SETTINGS[rowIndex]['Google OU Path']
        ]);
      } else {
        if (CLASSROOM_SETTINGS[rowIndex]) {
          CLASSROOM_SETTINGS[rowIndex]['Classroom'] = '';
          CLASSROOM_SETTINGS[rowIndex]['Teacher'] = '';
          CLASSROOM_SETTINGS[rowIndex]['Google OU Path'] = '';
          CLASSROOM_SETTINGS[rowIndex]['Students'] = '';
        }

        // Push the blank values as an array
        classroomSettings.push(['', '',  '', '']);
      }
    });

    return classroomSettings;
  }

  function getEmergencySettings() {
    const tableBody = document.querySelector('#emergencyGroups tbody');
    const rows = tableBody.querySelectorAll('tr');
    const emergencySettings = [];

    rows.forEach((row, rowIndex) => {
      const groupRange = row.querySelector(`#groupRange-input-${rowIndex}`).value;
      const groupName = row.querySelector(`#groupName-input-${rowIndex}`).value;
      const colorHex = row.querySelector(`#color-input-${rowIndex}`).value;

      // Push the values as an array
      emergencySettings.push([groupRange, groupName, colorHex]);
    });

    return emergencySettings;
  }

  function showError(errorType, callback = "") {
    let icon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color);"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "operationInProgress":
        title = icon + "Error";
        message = "Operation currently in progress. Please wait until the operation completes and try again.";
        button1 = "Close";
        break;
    }

    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
  
  function saveAlert() {
    saveFlag = false;
    saveChangesButton.classList.add('tool-bar-button-unsaved');
  }
  </script>
