<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let SCHOOL_DATA;
  let SCHOOL_SETTINGS;
  let CLASSROOM_SETTINGS;
  let EMERGENCY_SETTINGS;

  // Global flags
  let saveFlag = true; // True if all changes saved, false if unsaved changes
  let busyFlag = false; // True if backup in progress, false if backup not in progress

  // Initialize application
  window.onload = async function() {
    console.log("Initializing dashboard...");

    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
      // Show loading indicator
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      await Promise.all([
        updateData(),
        setEventListeners()
      ]);

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

    document.getElementById('syncButton').addEventListener('click', syncData);
    document.getElementById('schoolInfoButton').addEventListener('click', schoolInfo);
    document.getElementById('rostersButton').addEventListener('click', exportRosters);
    document.getElementById('labelsButton').addEventListener('click', exportLabels);
    document.getElementById('exportDataButton').addEventListener('click', exportData);
    
    const searchFilters = document.querySelectorAll('.search-filter');
    searchFilters.forEach((filter, index) => {
      filter.addEventListener('change', filterSchoolRoster);
    });

    // Add the search event listener
    const searchInput = document.getElementById('studentSearch');
    searchInput.addEventListener('input', filterSchoolRoster);

    // Add the roster options event listener
    const rosterType = document.getElementById('rosterTypeSelect');
    rosterType.addEventListener('change', showRosterFormat);

    // Add the label format event listener
    const labelFormat = document.getElementById('labelFormatSelect');
    labelFormat.addEventListener('change', showLabelFormat);

    // Check for unsaved changes or busy state before closing the window
    window.addEventListener('beforeunload', function (e) {
      if (!saveFlag || busyFlag) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    console.log("Event listeners set!");
  }

  // Create the school roster table
  function populateSchoolRoster() {
    const table = document.querySelector('#schoolRoster');
    const tableBody = document.querySelector('#schoolRoster tbody');
    const searchInput = document.getElementById('studentSearch');

    if (SCHOOL_DATA.length < 1) {
        table.style.display = 'none';
        return;
    } else {
        table.style.display = '';
    }

    // Clear existing rows and search query
    tableBody.innerHTML = '';
    searchInput.value = '';

    // Create a document fragment to improve performance
    const fragment = document.createDocumentFragment();

    SCHOOL_DATA.forEach(student => {
        const row = document.createElement('tr');

        // Helper function to create and append cells
        const createAndAppendCell = (textContent) => {
            const cell = document.createElement('td');
            cell.textContent = textContent;
            row.appendChild(cell);
        };

        // Create cells for each student property
        createAndAppendCell(student['Last Name']);
        createAndAppendCell(student['First Name']);
        createAndAppendCell(student['Grade']);
        createAndAppendCell(student['Classroom']);
        createAndAppendCell(student['Teacher']);
        createAndAppendCell(student['Emergency Group']);

        // Append row to the document fragment
        fragment.appendChild(row);
    });

    // Append the document fragment to the table body
    tableBody.appendChild(fragment);
  }

  // Populate data modal
  function populateSchoolInfoModal() {
    console.log("Populating school info modal...");

    const schoolName = document.getElementById('schoolInfoSchoolName');
    const schoolYear = document.getElementById('schoolInfoSchoolYear');
    const totalStudents = document.getElementById('schoolInfoTotalStudents');
    const lastSync = document.getElementById('schoolInfoLastSync');
    
    schoolName.textContent = SCHOOL_SETTINGS['School Name'];
    schoolYear.textContent = SCHOOL_SETTINGS['School Year'];
    totalStudents.textContent = SCHOOL_SETTINGS['Total Students'];
    lastSync.textContent = SCHOOL_SETTINGS['Last Sync'];
    
    // Get the table body element by ID
    const tableBody = document.getElementById('schoolInfoClassData').getElementsByTagName('tbody')[0];

    // Clear existing rows
    tableBody.innerHTML = '';

    // Populate the table with the data
    Object.values(CLASSROOM_SETTINGS).forEach(settings => {
        const row = tableBody.insertRow();
        const gradeCell = row.insertCell(0);
        const classroomCell = row.insertCell(1);
        const teacherCell = row.insertCell(2);
        const studentsCell = row.insertCell(3);

        gradeCell.textContent = settings['Grade'];
        classroomCell.textContent = settings['Classroom'];
        teacherCell.textContent = settings['Teacher'];
        studentsCell.textContent = settings['Students'];
    });
  }

  function populateRostersModal() {
    const classroomSelect = document.getElementById('classRosterSelect');
    const emergencySelect = document.getElementById('emergencyRosterSelect');

    // Clear existing options
    classroomSelect.innerHTML = '';
    emergencySelect.innerHTML = '';
    
    // Add 'All classrooms' option
    let allClassroomsOption = document.createElement('option');
    allClassroomsOption.value = 'allClassrooms';
    allClassroomsOption.textContent = 'All classrooms';
    classroomSelect.appendChild(allClassroomsOption);

    // Add 'All emergency groups' option
    let allEmergencyGroupsOption = document.createElement('option');
    allEmergencyGroupsOption.value = 'allEmergencyGroups';
    allEmergencyGroupsOption.textContent = 'All emergency groups';
    emergencySelect.appendChild(allEmergencyGroupsOption);

    CLASSROOM_SETTINGS.forEach(classroom => {
      const classroomValue = classroom['Classroom'];
      const teacherValue = classroom['Teacher'];
       
      if (classroomValue || teacherValue) {
        const option = document.createElement('option');
        option.value = classroomValue || teacherValue;

        if (classroomValue && teacherValue) {
          option.textContent = `${classroomValue} - ${teacherValue}`;
        } else if (classroomValue) {
          option.textContent = classroomValue;
        } else {
          option.textContent = teacherValue;
       }

        classroomSelect.appendChild(option);
      }
    });

    EMERGENCY_SETTINGS.forEach(emergencyGroup => {
      const groupName = emergencyGroup['Group Name'];
      if (groupName) {
        const option = document.createElement('option');
        option.value = emergencyGroup['Group Name'];
        option.textContent = `${emergencyGroup['Group Name']}`;
        emergencySelect.appendChild(option);
      }
    });
  }

  // Populate labels modal
  function populateLabelsModal() {
    const select = document.getElementById('labelClassroomSelect');

    // Clear existing options
    select.innerHTML = '';

    // Add 'All classrooms' option
    let allClassroomsOption = document.createElement('option');
    allClassroomsOption.value = 'allClassrooms';
    allClassroomsOption.textContent = 'All classrooms';
    select.appendChild(allClassroomsOption);
    
    CLASSROOM_SETTINGS.forEach(classroom => {
      const classroomValue = classroom['Classroom'];
      const teacherValue = classroom['Teacher'];
       
      if (classroomValue || teacherValue) {
        const option = document.createElement('option');
        option.value = classroomValue || teacherValue;

        if (classroomValue && teacherValue) {
          option.textContent = `${classroomValue} - ${teacherValue}`;
        } else if (classroomValue) {
          option.textContent = classroomValue;
        } else {
          option.textContent = teacherValue;
       }

        select.appendChild(option);
      }
    });
  }

  // Populate the dashboard
  function populateDashboard() {
    console.log("Populating dashboard...")
    
    const results = document.querySelectorAll('#schoolRoster tbody tr');
    const searchResults = document.getElementById('searchResults');
    
    searchResults.innerHTML = `<b>Students found:</b> ${results.length}`;
    document.getElementById('rosterHeader').innerText = SCHOOL_SETTINGS['School Name'] + " - School Roster - " + SCHOOL_SETTINGS['School Year'];
  }

  ///////////////
  // SYNC DATA //
  ///////////////

  async function syncData() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    const message = "All school rosters and data will be updated. Are you sure you wish to proceed?";
    const title = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>Sync Rosters`;

    const buttonText = await showModal(title, message, "Cancel", "Proceed");

    if (buttonText === "Cancel") {
      return;
    }

    busyFlag = true;
    let toastMessage;

    try {
      toastMessage = "Syncing data with Google Admin directory...";
      showToast("", toastMessage, 10000);

      // Sync Admin Directory
      await new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(function(response) {
          if (response === "missingDomain" || response === "missingClassrooms" ||
              response === "missingEmergencyGroups" || response === "orgUnitNotFound" || 
              response === "syncFailure") {
            reject(response);
          } else {
            resolve(response);
          }
        }).syncAdminDirectory();
      });

      await updateData();

      // Handle success case
      toastMessage = "Sync completed successfully!";
      playNotificationSound("sync");
      showToast("", toastMessage, 5000);
      console.log("Sync complete!");
    } catch (error) {
      // Handle error if any of the promises are rejected
      showError(error);
      console.error("Sync failed!");
    } finally {
      // Reset busy flag and update UI state
      busyFlag = false;
    }
  }

  /////////////////
  // SCHOOL INFO //
  /////////////////

  function schoolInfo() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    showHtmlModal("schoolInfoModal");
  }

  ////////////////////
  // EXPORT ROSTERS //
  ////////////////////

  function exportRosters() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    showHtmlModal("exportRostersModal");
    const downloadRostersModalButton = document.getElementById('downloadRosterModalButton');

    downloadRostersModalButton.onclick = function() {
      busyFlag = true;

      // Get roster type and selection
      const rosterType = document.getElementById('rosterTypeSelect').value;
      const selectedClassRoster = document.getElementById('classRosterSelect').value;
      const selectedEmergencyRoster = document.getElementById('emergencyRosterSelect').value;

      let allRostersData = [];
      let emergencyText;
      let selectElement;
      let selectedOptionText;
      let fileName;

      switch (rosterType) {
        case 'classRoster':
          selectElement = document.getElementById('classRosterSelect');
          selectedOptionText = selectElement.options[selectElement.selectedIndex].textContent;
          if (selectedOptionText === "All classrooms") {
            selectedOptionText = "All Classrooms";
          }
          fileName = selectedOptionText + " - Class Roster.pdf";
          
          if (selectedClassRoster === "allClassrooms") {
          
            // Get classrooms in the order they appear in CLASSROOM_SETTINGS
            const classroomsOrder = CLASSROOM_SETTINGS.map(classroom => classroom['Classroom']);

            classroomsOrder.forEach(classroom => {
              const filteredData = SCHOOL_DATA.filter(student => student['Classroom'] === classroom);
              
              if (filteredData.length > 0) {
                const titleData = filteredData[0];
                const grade = titleData['Grade'];
                const teacher = titleData['Teacher'];
                const titleText = `${grade} - ${classroom} - ${teacher} - ` + SCHOOL_SETTINGS['School Year'];

                // Get emergency message if available
                emergencyText = getEmergencyMessage();

                const rosterText = getRosters(rosterType, filteredData);
                allRostersData.push({ titleText, emergencyText, rosterText });
              }
            });

            // Combine all rosters data and add page breaks
            writeClassRoster(allRostersData, fileName);
          } else {
            const filteredData = SCHOOL_DATA.filter(student => student['Classroom'] === selectedClassRoster);

            if (filteredData.length > 0) {
              const titleData = filteredData[0];
              const grade = titleData['Grade'];
              const classroom = titleData['Classroom'];
              const teacher = titleData['Teacher'];
              const titleText = `${grade} - ${classroom} - ${teacher} - ` + SCHOOL_SETTINGS['School Year'];

              // Get emergency message if available
              emergencyText = getEmergencyMessage();

              const rosterText = getRosters(rosterType, filteredData);
              writeClassRoster([{ titleText, emergencyText, rosterText }], fileName);
            }
          }
          break;

        case 'emergencyGroupRoster':
          selectElement = document.getElementById('emergencyRosterSelect');
          selectedOptionText = selectElement.options[selectElement.selectedIndex].textContent;
          if (selectedOptionText === "All emergency groups") {
            selectedOptionText = "All Emergency Groups";
          }
          fileName = selectedOptionText + " - Emergency Group Roster.pdf";

          if (selectedEmergencyRoster === "allEmergencyGroups") {
            
            // Get emergency groups in the order they appear in EMERGENCY_SETTINGS
            const emergencyGroupsOrder = EMERGENCY_SETTINGS.map(emergencyGroup => emergencyGroup['Group Name']);

            emergencyGroupsOrder.forEach(emergencyGroup => {
              const filteredData = SCHOOL_DATA.filter(student => student['Emergency Group'] === emergencyGroup);
              
              if (filteredData.length > 0) {
                const groupSetting = EMERGENCY_SETTINGS.find(group => group['Group Name'] === emergencyGroup);
                const fillColor = groupSetting ? groupSetting['Color Hex'] : 'null';
                const titleText = {
                  text: `${emergencyGroup} - ` + SCHOOL_SETTINGS['School Year'],
                  fillColor: fillColor,
                  fontSize: 20, bold: true,
                  alignment: 'center',
                  margin: [0, 5, 0, 5]
                };

                // Get emergency message if available
                emergencyText = getEmergencyMessage();

                const rosterText = getRosters(rosterType, filteredData);
                allRostersData.push({ titleText, emergencyText, rosterText });
              }
            });

            // Combine all rosters data and add page breaks
            writeEmergencyGroupRoster(allRostersData, fileName);
          
          } else {
              const filteredData = SCHOOL_DATA.filter(student => student['Emergency Group'] === selectedEmergencyRoster);

              if (filteredData.length > 0) {
                // Get the corresponding fill color
                const groupSetting = EMERGENCY_SETTINGS.find(group => group['Group Name'] === selectedEmergencyRoster);
                const fillColor = groupSetting ? groupSetting['Color Hex'] : 'null';
                const titleText = {
                  text: `${selectedEmergencyRoster} - ` + SCHOOL_SETTINGS['School Year'],
                  fillColor: fillColor,
                  fontSize: 20, bold: true,
                  alignment: 'center',
                  margin: [0, 5, 0, 5]
                };
                
                // Get emergency message if available
                emergencyText = getEmergencyMessage();

                const rosterText = getRosters(rosterType, filteredData);
                writeEmergencyGroupRoster([{ titleText, emergencyText, rosterText }], fileName);
              }
          }
          break;

        case 'schoolRoster':
          fileName = "School Roster.pdf";
          const filteredData = SCHOOL_DATA;

          if (filteredData.length > 0) {
            const titleText = SCHOOL_SETTINGS['School Name'] + " - School Roster - " + SCHOOL_SETTINGS['School Year'];

            // Get emergency message if available
            emergencyText = getEmergencyMessage();

            const rosterText = getRosters(rosterType, filteredData);
            writeSchoolRoster([{ titleText, emergencyText, rosterText }], fileName);
          }
          break;
      }

      closeHtmlModal("exportRostersModal");
      busyFlag = false;
    }
  }

  // Format the data for PDFMake
  function getRosters(rosterType, filteredData) {
    let data;

    switch (rosterType) {
      case 'classRoster':
        data = filteredData.map((student, index) => {
          const fillColor = getEmergencyColor(student['Emergency Group']);
          return [
            { text: (index + 1).toString(), style: 'tableCell', fillColor: fillColor },
            { text: student['Last Name'], style: 'tableCell', fillColor: fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor: fillColor },
            ...Array(14).fill({ text: '', style: 'tableCell', fillColor: fillColor })
          ];
        });
        break;

      case 'emergencyGroupRoster':
        data = filteredData.map((student, index) => {
          const fillColor = getEmergencyColor(student['Emergency Group']);
          return [
            { text: student['Last Name'], style: 'tableCell', fillColor: fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor: fillColor },
            { text: student['Grade'], style: 'tableCell', fillColor: fillColor },
            { text: student['Classroom'], style: 'tableCell', fillColor: fillColor },
            { text: '', style: 'tableCell', fillColor: fillColor }
          ];
        });
        break;

      case 'schoolRoster':
        data = filteredData.map((student, index) => {
          const fillColor = getEmergencyColor(student['Emergency Group']);
          return [
            { text: student['Last Name'], style: 'tableCell', fillColor: fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor: fillColor },
            { text: student['Grade'], style: 'tableCell', fillColor: fillColor },
            { text: student['Classroom'], style: 'tableCell', fillColor: fillColor },
          ];
        });
        break;
    }

    return data;
  }

  function getEmergencyColor(groupName) {
    const emergencyColorToggle = document.getElementById('showEmergencyColor').checked;
    
    if (emergencyColorToggle) {
      const group = EMERGENCY_SETTINGS.find(setting => setting['Group Name'] === groupName);
      return group['Color Hex'];
    }
    return null;    
  }
  
  function getEmergencyMessage () {
    const emergencyMessageToggle = document.getElementById('showEmergencyMessage').checked;
    let emergencyMessage = '';

    if (emergencyMessageToggle) {
      for (let i = 0; i < EMERGENCY_SETTINGS.length; i++) {
        if ('Message' in EMERGENCY_SETTINGS[i]) {
          emergencyMessage = EMERGENCY_SETTINGS[i]['Message'];
          break;
        }
      }
    }
    return emergencyMessage;
  }

  ///////////////////
  // EXPORT LABELS //
  ///////////////////

  function exportLabels() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }

    showHtmlModal("exportLabelsModal");
    const downloadLabelsModalButton = document.getElementById('downloadLabelsModalButton');
    
    downloadLabelsModalButton.onclick = function() {
      busyFlag = true;
      
      const selectElement = document.getElementById('labelClassroomSelect');
      const classroom = document.getElementById('labelClassroomSelect').value;
      const templateType = document.getElementById('labelTemplateSelect').value;
      const formatType = document.getElementById('labelFormatSelect').value;
      
      let selectedOptionText = selectElement.options[selectElement.selectedIndex].textContent;
      if (selectedOptionText === "All classrooms") {
        selectedOptionText = "All Classrooms";
      }

      let labelData;
      let fileName;

      switch (templateType) {
        case 'avery5160':
          labelData = getLabels(classroom, templateType, formatType);
          fileName = selectedOptionText + " - Avery 5160.pdf" 
          writeLabels(templateType, labelData, fileName);
          break;
        case 'avery8167':
          labelData = getLabels(classroom, templateType, formatType);
          fileName = selectedOptionText + " - Avery 8167.pdf" 
          writeLabels(templateType, labelData, fileName);
          break;
        case 'avery95945':
          labelData = getLabels(classroom, templateType, formatType);
          fileName = selectedOptionText + " - Avery 95945.pdf" 
          writeLabels(templateType, labelData, fileName);
          break;
      }

      closeHtmlModal("exportLabelsModal");
      busyFlag = false;
    }
  }

  function getLabels(classroom, templateType, formatType) {
    let filteredData;

    if (classroom === "allClassrooms") {
      filteredData = SCHOOL_DATA;
    } else {
      filteredData = SCHOOL_DATA.filter(student => student['Classroom'] === classroom);
    }

    let data;

    if (formatType === 'labelTeacher') {
      // Extract teacher names
      const uniqueTeachers = [...new Set(filteredData.map(student => student['Teacher']))];
      
      // Sort the teacher names alphabetically
      uniqueTeachers.sort((a, b) => a.localeCompare(b));

      // Map each teacher to the required label format
      data = uniqueTeachers.map(teacher => {
        let text = [{ text: `${teacher}`, bold: true }];
        return { text, style: templateType };
      });
    } else {
        data = filteredData.map(student => {
          let text = [{ text: `${student['First Name']} ${student['Last Name']}`, bold: true }];

            switch (formatType) {
              case 'labelStudentGrade':
                text.push(`\n${student['Grade']} - ${student['Classroom']}`);
                break;
              case 'labelStudentTeacher':
                text.push(`\n${student['Classroom']} - ${student['Teacher']}`);
                break;
              case 'labelEmergency':
                text.push(`\n${student['Classroom']} - ${student['Emergency Group']}`);
                break;
              default:
                break;
            }

            return { text, style: templateType };
        });
    }

    let templateBody = [];

    switch (templateType) {
      case 'avery5160':
        for (let i = 0; i < data.length; i += 3) {
          let row = [
            { text: data[i] ? data[i].text : '' },
            { text: '', style: templateType },
            { text: data[i + 1] ? data[i + 1].text : '' },
            { text: '', style: templateType },
            { text: data[i + 2] ? data[i + 2].text : '' }
          ];
          templateBody.push(row);
        }
        break;

      case 'avery8167':
        for (let i = 0; i < data.length; i += 4) {
          let row = [
            { text: data[i] ? data[i].text : '' },
            { text: '', style: templateType },
            { text: data[i + 1] ? data[i + 1].text : '' },
            { text: '', style: templateType },
            { text: data[i + 2] ? data[i + 2].text : '' },
            { text: '', style: templateType },
            { text: data[i + 3] ? data[i + 3].text : '' }
          ];
          templateBody.push(row);
        }
        break;

      case 'avery95945':
        for (let i = 0; i < data.length; i += 2) {
          let row = [
            { text: data[i] ? data[i].text : '' },
            { text: '', style: templateType },
            { text: data[i + 1] ? data[i + 1].text : '' },
          ];
          templateBody.push(row);
        }
        break;
    }

    return templateBody;
  }

  /////////////////
  // EXPORT DATA //
  /////////////////

  function exportData() {
    if (busyFlag) {
      showError("operationInProgress");
      return;
    }
    
    showHtmlModal("exportDataModal");
    const exportDataModalButton = document.getElementById('exportDataModalButton');
    
    exportDataModalButton.onclick = function() {
      busyFlag = true;
    
      const fileType = document.getElementById('fileTypeSelect').value;
      
      switch (fileType) {
        case 'csv':
          google.script.run.withSuccessHandler(function(data) {
            let a = document.createElement('a');
            
            a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(data);
            a.download = 'School Data.csv';
            a.click();
            busyFlag = false;
          }).getCsv();
          break;
        case 'xlsx':
          google.script.run.withSuccessHandler(function(data) {
            // Convert the raw data into a Uint8Array
            const uint8Array = new Uint8Array(data);
                    
            // Create a Blob from the binary data
            const blob = new Blob([uint8Array], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            
            const url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = 'School Data.xlsx';
            a.click();
            URL.revokeObjectURL(url);
            busyFlag = false;
          }).getXlsx();
          break;
      }
      
      closeHtmlModal("exportDataModal");
      resetModal();
    };
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  async function updateData() {
    // Fetch data
    const [schoolData, schoolSettings, classroomSettings, emergencySettings] = await Promise.all([
      new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getSchoolData();
      }),     
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
    SCHOOL_DATA = schoolData;
    SCHOOL_SETTINGS = schoolSettings;
    CLASSROOM_SETTINGS = classroomSettings;
    EMERGENCY_SETTINGS = emergencySettings;

    // Populate elements with data
    await Promise.all([
      populateSchoolRoster(),
      populateSchoolInfoModal(),
      populateRostersModal(),
      populateLabelsModal(),
      populateDashboard(),
    ]);
  }
  
  function filterSchoolRoster() {
    const query = document.getElementById('studentSearch').value.toLowerCase();
    const table = document.getElementById('schoolRoster');
    const rows = document.querySelectorAll('#schoolRoster tbody tr');
    const searchResults = document.getElementById('searchResults');
    let matchesFound = 0;

    // Get the current state of checkboxes to determine search columns
    const checkboxes = document.querySelectorAll('.search-filter');
    const searchColumns = [];

    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            searchColumns.push(parseInt(checkbox.getAttribute('data-column')));
        }
    });

    // If no checkboxes are checked, search all columns (include all indices)
    if (searchColumns.length === 0) {
        for (let i = 0; i < checkboxes.length; i++) {
            searchColumns.push(i);
        }
    }

    // Function to filter the table rows based on current checkboxes state and search query
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;

        cells.forEach((cell, columnIndex) => {
            // Check if the cell content matches the query and is in the selected columns
            if (searchColumns.includes(columnIndex) && cell.textContent.toLowerCase().includes(query)) {
                match = true;
            }
        });

        if (match) {
            row.style.display = '';
            matchesFound++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update search results message based on matches found
    if (matchesFound === 0) {
        table.style.display = 'none';
        searchResults.innerHTML = '<b>No students found!</b>';
    } else {
        table.style.display = 'table';
        searchResults.innerHTML = `<b>Students found:</b> ${matchesFound}`;

        // Add the class to the last visible row
        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        
        if (visibleRows.length > 0) {
          visibleRows[visibleRows.length - 1].classList.add('last-visible-row');
        }
    }
  }

  function resetModal() {
    const modalSwitches = document.querySelectorAll('input');
    const modalSelects = document.querySelectorAll ('#exportRostersModal select, #exportLabelsModal select, #exportDataModal select');

    // Reset switches
    modalSwitches.forEach(function(input) {
      input.checked = false;
    });

    // Reset select boxes
    modalSelects.forEach(function(select) {
      select.selectedIndex = 0; // Reset to the first option
    });

    // Reset the export rosters options
    document.getElementById('classroomSelect').style.display = 'block';
    document.getElementById('emergencyGroupSelect').style.display = 'none';

    // Reset the label preview
    document.getElementById('labelRow1').innerHTML = "<b>Student Name</b>";
    document.getElementById('labelRow2').innerHTML = "";

    // Reset the scroll position of the modal body
    const modalContent = document.querySelector('.modal-htmlcontent');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
  }

  function showLabelFormat() {
    const labelFormat = document.getElementById('labelFormatSelect').value;

    switch (labelFormat) {
      case 'labelStudent':
        document.getElementById('labelRow1').innerHTML = "<b>Student Name</b>";
        document.getElementById('labelRow2').innerHTML = "";
        break;
      case 'labelTeacher':
        document.getElementById('labelRow1').innerHTML = "<b>Teacher Name</b>";
        document.getElementById('labelRow2').innerHTML = "";
        break;
      case 'labelStudentGrade':
        document.getElementById('labelRow1').innerHTML = "<b>Student Name</b>";
        document.getElementById('labelRow2').innerHTML = "Grade - Classroom";
        break;
      case 'labelStudentTeacher':
        document.getElementById('labelRow1').innerHTML = "<b>Student Name</b>";
        document.getElementById('labelRow2').innerHTML = "Classroom - Teacher";
        break;
      case 'labelEmergency':
        document.getElementById('labelRow1').innerHTML = "<b>Student Name</b>";
        document.getElementById('labelRow2').innerHTML = "Classroom - Emergency Group";
        break;
    }
  }

  function showRosterFormat() {
    const rosterType = document.getElementById('rosterTypeSelect');
    const classroomSelect = document.getElementById('classroomSelect');
    const emergencySelect = document.getElementById('emergencyGroupSelect');
    const rosterTypeValue = document.getElementById('rosterTypeSelect').value;

    if (rosterTypeValue === 'classRoster') {
      classroomSelect.style.display = 'block';
      emergencySelect.style.display = 'none';
      rosterType.style.marginBottom = '10px';
    }
    
    else if (rosterTypeValue === 'emergencyGroupRoster') {
      classroomSelect.style.display = 'none';
      emergencySelect.style.display = 'block';
      rosterType.style.marginBottom = '10px';
    }

    else if (rosterTypeValue === 'schoolRoster') {
      classroomSelect.style.display = 'none';
      emergencySelect.style.display = 'none';
      rosterType.style.marginBottom = '0';
    }
  }

  ////////////////////
  // ERROR HANDLING //
  ////////////////////

  function showError(errorType, callback = "") {
    const warningIcon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color);"></i>`;
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color);"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "operationInProgress":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;

      case "missingDomain":
        title = errorIcon + "Missing Google Domain";
        message = "Please enter a Google domain for the school and try again.";
        button1 = "Close";
        break;

      case "missingClassrooms":
        title = errorIcon + "Missing Classrooms";
        message = "No classrooms found. Please review the classrooms/organizational unit paths and try again.";
        button1 = "Close";
        break;

      case "missingEmergencyGroups":
        title = errorIcon + "Missing Emergency Groups";
        message = "No emergency groups found. Please review the emergency groups and try again.";
        button1 = "Close";
        break;

      case "orgUnitNotFound":
        title = errorIcon + "Organization Unit Not Found";
        message = "One or more organization units could not be found in the domain. Please review the domain/organizational unit paths and try again.";
        button1 = "Close";
        break;

      case "syncFailure":
        title = errorIcon + "Sync Error";
        message = "One or more organizational units failed to sync. Please review the domain/organizational unit paths and try again.";
        button1 = "Close";
        break;
    }
    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
</script>
