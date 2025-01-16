<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let SCHOOL_DATA;
  let APP_SETTINGS;

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

  async function updateData() {
    // Fetch data
    const [schoolData, appSettings] = await Promise.all([
      new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getSchoolData();
      }),     
      new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
      })
    ]);

    // Set global variables
    SCHOOL_DATA = schoolData;
    APP_SETTINGS = appSettings;

    // Populate elements with data
    await Promise.all([
      populateSchoolRoster(),
      populateSchoolInfoModal(),
      populateRostersModal(),
      populateLabelsModal()
    ]);
  }

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

    console.log("Complete!");
  }

  // Populate school roster table
  function populateSchoolRoster() {
    const table = document.querySelector('#schoolRoster');
    const tableBody = document.querySelector('#schoolRoster tbody');
    const searchInput = document.getElementById('studentSearch');
    const searchResults = document.getElementById('searchResults');

    if (SCHOOL_DATA.length < 1) {
        table.style.display = 'none';
        searchResults.innerHTML = `<b>No students found!</b>`;
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

    // Show search results    
    const results = document.querySelectorAll('#schoolRoster tbody tr');
    searchResults.innerHTML = `<b>Students found:</b> ${results.length}`;
    
    // Show header text
    const schoolName = APP_SETTINGS.schoolSettings.schoolName;
    const schoolYear = APP_SETTINGS.schoolSettings.schoolYear;
    const rosterHeader = document.getElementById('rosterHeader');
    rosterHeader.innerText = schoolName + " - School Roster - " + schoolYear;
  }

  // Populate school info
  function populateSchoolInfoModal() {
    const elements = {
      schoolName: document.getElementById('schoolInfoSchoolName'),
      schoolYear: document.getElementById('schoolInfoSchoolYear'),
      totalStudents: document.getElementById('schoolInfoTotalStudents'),
      lastSync: document.getElementById('schoolInfoLastSync'),
      tableBody: document.getElementById('schoolInfoClassData').getElementsByTagName('tbody')[0]
    };
    
    const { schoolName, schoolYear, lastSync } = APP_SETTINGS.schoolSettings;

    // Update basic school information
    elements.schoolName.textContent = schoolName;
    elements.schoolYear.textContent = schoolYear;
    elements.totalStudents.textContent = SCHOOL_DATA.length;
    elements.lastSync.textContent = lastSync;

    // Clear existing table content
    elements.tableBody.textContent = '';

    // Count students per classroom in a single pass
    const studentCounts = SCHOOL_DATA.reduce((counts, student) => {
      counts[student.Classroom] = (counts[student.Classroom] || 0) + 1;
      return counts;
    }, {});

    // Create document fragment for batch DOM updates
    const fragment = document.createDocumentFragment();

    // Create table rows
    Object.values(APP_SETTINGS.classroomSettings).forEach(settings => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${settings.grade}</td>
        <td>${settings.classroom}</td>
        <td>${settings.teacher}</td>
        <td>${studentCounts[settings.classroom] || 0}</td>
      `;
      fragment.appendChild(row);
    });

    // Batch update DOM
    elements.tableBody.appendChild(fragment);
  }

  // Popular rosters modal
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

    APP_SETTINGS.classroomSettings.forEach(classroom => {
      const classroomValue = classroom.classroom;
      const teacherValue = classroom.teacher;
       
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

    APP_SETTINGS.emergencyGroupSettings.forEach(emergencyGroup => {
      const groupName = emergencyGroup.group;
      if (groupName) {
        const option = document.createElement('option');
        option.value = emergencyGroup.group;
        option.textContent = `${emergencyGroup.group}`;
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
    
    APP_SETTINGS.classroomSettings.forEach(classroom => {
      const classroomValue = classroom.classroom;
      const teacherValue = classroom.teacher;
       
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

  ///////////////
  // SYNC DATA //
  ///////////////

  async function syncData() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    const message = "All school rosters and data will be updated. Are you sure you wish to proceed?";
    const title = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>Sync Rosters`;

    const buttonText = await showModal(title, message, "Cancel", "Proceed");

    if (buttonText === "Cancel") {
      return;
    }

    busyFlag = true;
    showToast("", "Syncing data with Google Admin directory...", 10000);

    google.script.run
      .withSuccessHandler(() => {
        updateData().then(() => {
          showToast("", "Sync completed successfully!", 5000);
          playNotificationSound("sync");
          busyFlag = false; // Reset busyFlag here
        });
      })
      .withFailureHandler((error) => {
        const errorString = String(error);

        if (errorString.includes("401")) {
          sessionError();
        } else if (errorString.includes("permission")) {
          showError("Error: PERMISSION");
        } else {
          showError(error.message);
        }

        busyFlag = false; // Reset busyFlag here as well
      })
      .syncAdminDirectory();
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
          
            // Get classrooms in the order they appear in APP_SETTINGS
            const classroomsOrder = APP_SETTINGS.classroomSettings.map(classroom => classroom.classroom);

            classroomsOrder.forEach(classroom => {
              const filteredData = SCHOOL_DATA.filter(student => student['Classroom'] === classroom);
              
              if (filteredData.length > 0) {
                const titleData = filteredData[0];
                const grade = titleData['Grade'];
                const teacher = titleData['Teacher'];
                const titleText = `${grade} - ${classroom} - ${teacher} - ` + APP_SETTINGS.schoolSettings.schoolYear;

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
              const titleText = `${grade} - ${classroom} - ${teacher} - ` + APP_SETTINGS.schoolSettings.schoolYear;

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
            
            // Get emergency groups in the order they appear in APP_SETTINGS
            const emergencyGroupsOrder = APP_SETTINGS.emergencyGroupSettings.map(emergencyGroup => emergencyGroup.group);

            emergencyGroupsOrder.forEach(emergencyGroup => {
              const filteredData = SCHOOL_DATA.filter(student => student['Emergency Group'] === emergencyGroup);
              
              if (filteredData.length > 0) {
                const groupSetting = APP_SETTINGS.emergencyGroupSettings.find(group => group.group === emergencyGroup);
                const fillColor = groupSetting ? groupSetting.color : 'null';
                const titleText = {
                  text: `${emergencyGroup} - ` + APP_SETTINGS.schoolSettings.schoolYear,
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
                const groupSetting = APP_SETTINGS.emergencyGroupSettings.find(group => group.group === selectedEmergencyRoster);
                const fillColor = groupSetting ? groupSetting.color : 'null';
                const titleText = {
                  text: `${selectedEmergencyRoster} - ` + APP_SETTINGS.schoolSettings.schoolYear,
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
            const titleText = APP_SETTINGS.schoolSettings.schoolName + " - School Roster - " + APP_SETTINGS.schoolSettings.schoolYear;

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
        
        // Add blank rows to ensure the total is 25
        while (data.length < 25) {
          const blankIndex = data.length + 1;
          const blankRow = [
            { text: blankIndex.toString(), style: 'tableCell', fillColor: null },
            ...Array(16).fill({ text: '', style: 'tableCell', fillColor: null })
          ];
          data.push(blankRow);
        }
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
    const emergencyColorToggle = document.getElementById('showEmergencyColor')?.checked || false;

    if (emergencyColorToggle) {
        const group = APP_SETTINGS.emergencyGroupSettings.find(setting => setting.group === groupName);
        return group ? group.color : null; // Return null if group not found
    }
    return null; // Return null if toggle is off
  }
  
  function getEmergencyMessage () {
    const emergencyMessageToggle = document.getElementById('showEmergencyMessage').checked;
    let emergencyMessage = '';

    if (emergencyMessageToggle) {
      emergencyMessage = APP_SETTINGS.schoolSettings.emergencyMessage;
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
    };
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

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

    // Reset switches
    modalSwitches.forEach(function(input) {
      input.checked = false;
    });
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
      case "Error: OPERATION_IN_PROGRESS":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_DOMAIN":
        title = errorIcon + "Missing Google Domain";
        message = "Please enter a Google domain for the school and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CLASSROOMS":
        title = errorIcon + "Missing Classrooms";
        message = "No classrooms found. Please review the classrooms/organizational unit paths and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_EMERGENCY_GROUPS":
        title = errorIcon + "Missing Emergency Groups";
        message = "No emergency groups found. Please review the emergency groups and try again.";
        button1 = "Close";
        break;

      case "Error: SYNC_FAILURE":
        title = errorIcon + "Sync Error";
        message = "One or more organizational units failed to sync. Please review the domain/organizational unit paths and try again.";
        button1 = "Close";
        break;

      case "Error: PERMISSION":
        title = errorIcon + "Permission Error";
        message = "You do not have permission to modify the database. Please contact your administrator. The operation could not be completed.";
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
</script>
