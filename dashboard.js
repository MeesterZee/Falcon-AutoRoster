<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let SCHOOL_DATA;
  let APP_SETTINGS;

  // Global flags
  let busyFlag = false; // True if backup in progress, false if backup not in progress
  let sortOrder = {};

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
    document.getElementById('toggleFilterButton').addEventListener('click', showToggleFilterSidebar);
    
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

    console.log("Complete!");

    // Add event listener for table sorting with clickable headers
    document.querySelectorAll("#schoolRoster thead th").forEach((header, columnIndex) => {
      header.style.cursor = "pointer";

      // Add sort icon element
      const icon = document.createElement("i");
      icon.classList.add("bi", "sort-icon");
      header.appendChild(icon);

      // Add sorting event listener
      header.addEventListener("click", () => sortTable(columnIndex));
    });

    // Add event listener to prevent escaping dialogs
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const dialog = document.querySelector('dialog[open]');
        if (dialog) {
          event.preventDefault(); // Prevent ESC from closing the dialog
          
          // Remove focus from all buttons within the dialog
          const buttons = dialog.querySelectorAll('button');
          buttons.forEach((button) => {
            button.blur(); // Remove focus from button
          });
        }
      }
    });
  }

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

    SCHOOL_DATA.forEach((student, rowIndex) => {
        const row = document.createElement('tr');

        // Helper function to create and append normal text cells
        const createAndAppendCell = (textContent, bgColor = 'transparent', isEmergencyGroup = false) => {
            const cell = document.createElement('td');

            if (isEmergencyGroup) {
                // Create the inner div with padding and background color for emergency group
                const colorDiv = document.createElement('div');
                colorDiv.style.backgroundColor = bgColor;
                colorDiv.style.borderRadius = '5px';
                colorDiv.style.paddingLeft = '4px';
                colorDiv.textContent = textContent;

                // Adjust text color based on background color
                if (bgColor === '#ffffff') {
                    colorDiv.style.color = 'black';
                } else if (bgColor === '#000000') {
                    colorDiv.style.color = 'white';
                }

                cell.appendChild(colorDiv);
            } else {
                cell.textContent = textContent;
            }

            row.appendChild(cell);
        };

        // Create cells for each student property
        createAndAppendCell(student['Last Name']);
        createAndAppendCell(student['First Name']);
        createAndAppendCell(student['Grade']);
        createAndAppendCell(student['Classroom']);
        createAndAppendCell(student['Teacher']);

        // For Emergency Group, apply the background color using getColor
        const groupColor = getColor(student['Emergency Group']);
        createAndAppendCell(student['Emergency Group'], groupColor, true);

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
    rosterHeader.innerText = `${schoolName} - School Roster - ${schoolYear}`;

    initializeSorting();
  }

  function getColor(group) {
    // Find the matching group in emergencyGroupSettings
    const match = APP_SETTINGS.emergencyGroupSettings.find(
      (setting) => setting.group === group
    );
    // Return the color if there's a match; otherwise, return null
    return match ? match.color : null;
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

    const buttonText = await showAlertModal(title, message, "Cancel", "Proceed");

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
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    showActionModal("schoolInfoModal");
  }

  ////////////////////
  // EXPORT ROSTERS //
  ////////////////////

  function exportRosters() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    showActionModal("exportRostersModal");
    const downloadBtn = document.getElementById('downloadRosterModalButton');

    downloadBtn.onclick = function () {
      busyFlag = true;

      const rosterType = document.getElementById('rosterTypeSelect').value;
      const classValue = document.getElementById('classRosterSelect').value;
      const emergencyValue = document.getElementById('emergencyRosterSelect').value;

      const schoolYear = APP_SETTINGS.schoolSettings.schoolYear;
      let fileName = '';
      let allRostersData = [];

      // Emergency message logic moved here
      const emergencyText = [
        'emergencyClassRoster',
        'emergencyGroupRoster',
        'emergencySchoolRoster'
      ].includes(rosterType)
        ? getEmergencyMessage().trim()
        : " ";

      const processGroup = (items, filterKey, getTitleText, writer) => {
        items.forEach(key => {
          const data = SCHOOL_DATA.filter(s => s[filterKey] === key);
          if (data.length > 0) {
            const titleText = getTitleText(data, key);
            const rosterText = getRosters(rosterType, data);
            allRostersData.push({ titleText, emergencyText, rosterText });
          }
        });
        writer(allRostersData, fileName);
      };

      const getSelectedText = (id, allLabel, properLabel) => {
        const select = document.getElementById(id);
        let text = select.options[select.selectedIndex].textContent;
        return text === allLabel ? properLabel : text;
      };

      switch (rosterType) {
        case 'classRoster': {
          const isAll = classValue === "allClassrooms";
          const labelText = getSelectedText('classRosterSelect', "All classrooms", "All Classrooms");
          fileName = `${labelText} - "Class Roster".pdf`;

          if (isAll) {
            const classrooms = APP_SETTINGS.classroomSettings.map(c => c.classroom);
            processGroup(classrooms, 'Classroom', (data, room) => {
              const s = data[0];
              return `${s['Grade']} - ${room} - ${s['Teacher']} - ${schoolYear}`;
            }, writeClassRoster);
          } else {
            const data = SCHOOL_DATA.filter(s => s['Classroom'] === classValue);
            if (data.length > 0) {
              const s = data[0];
              const titleText = `${s['Grade']} - ${s['Classroom']} - ${s['Teacher']} - ${schoolYear}`;
              const rosterText = getRosters(rosterType, data);
              writeClassRoster([{ titleText, emergencyText, rosterText }], fileName);
            }
          }
          break;
        }

        case 'emergencyClassRoster': {
          const isAll = classValue === "allClassrooms";
          const labelText = getSelectedText('classRosterSelect', "All classrooms", "All Classrooms");
          fileName = `${labelText} - "Emergency Class Roster".pdf`;

          if (isAll) {
            const classrooms = APP_SETTINGS.classroomSettings.map(c => c.classroom);
            processGroup(classrooms, 'Classroom', (data, room) => {
              const s = data[0];
              return `${s['Grade']} - ${room} - ${s['Teacher']} - ${schoolYear}`;
            }, writeEmergencyClassRoster);
          } else {
            const data = SCHOOL_DATA.filter(s => s['Classroom'] === classValue);
            if (data.length > 0) {
              const s = data[0];
              const titleText = `${s['Grade']} - ${s['Classroom']} - ${s['Teacher']} - ${schoolYear}`;
              const rosterText = getRosters(rosterType, data);
              writeEmergencyClassRoster([{ titleText, emergencyText, rosterText }], fileName);
            }
          }
          break;
        }

        case 'emergencyGroupRoster': {
          const isAll = emergencyValue === "allEmergencyGroups";
          const labelText = getSelectedText('emergencyRosterSelect', "All emergency groups", "All Emergency Groups");
          fileName = `${labelText} - Emergency Group Roster.pdf`;

          if (isAll) {
            const groups = APP_SETTINGS.emergencyGroupSettings.map(g => g.group);
            processGroup(groups, 'Emergency Group', (_, group) => {
              const g = APP_SETTINGS.emergencyGroupSettings.find(x => x.group === group);
              return {
                text: `${group} - ${schoolYear}`,
                fillColor: g?.color || 'null',
                fontSize: 16,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 0]
              };
            }, writeEmergencyGroupRoster);
          } else {
            const data = SCHOOL_DATA.filter(s => s['Emergency Group'] === emergencyValue);
            if (data.length > 0) {
              const g = APP_SETTINGS.emergencyGroupSettings.find(x => x.group === emergencyValue);
              const titleText = {
                text: `${emergencyValue} - ${schoolYear}`,
                fillColor: g?.color || 'null',
                fontSize: 16,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 0]
              };
              const rosterText = getRosters(rosterType, data);
              writeEmergencyGroupRoster([{ titleText, emergencyText, rosterText }], fileName);
            }
          }
          break;
        }

        case 'schoolRoster':
        case 'emergencySchoolRoster': {
          const data = SCHOOL_DATA;
          if (data.length > 0) {
            fileName = `${APP_SETTINGS.schoolSettings.schoolName} - ${rosterType === 'schoolRoster' ? "School Roster" : "Emergency School Roster"} - ${schoolYear}.pdf`;
            const titleText = `${APP_SETTINGS.schoolSettings.schoolName} - School Roster - ${schoolYear}`;
            const rosterText = getRosters(rosterType, data);
            writeSchoolRoster([{ titleText, emergencyText, rosterText }], fileName);
          }
          break;
        }
      }

      closeActionModal("exportRostersModal");
      busyFlag = false;
    };
  }

  // Format the data for PDFMake
  function getRosters(rosterType, filteredData) {
    let data = [];

    const getFillColor = student =>
      rosterType.startsWith('emergency') ? getEmergencyColor(student['Emergency Group']) : null;

    switch (rosterType) {
      case 'classRoster':
      case 'emergencyClassRoster':
        data = filteredData.map((student, index) => {
          const fillColor = getFillColor(student);
          return [
            { text: (index + 1).toString(), style: 'tableCell', fillColor },
            { text: student['Last Name'], style: 'tableCell', fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor },
            ...Array(14).fill({ text: '', style: 'tableCell', fillColor }),
          ];
        });

        while (data.length < 25) {
          const blankIndex = data.length + 1;
          const blankRow = [
            { text: blankIndex.toString(), style: 'tableCell', fillColor: null },
            ...Array(16).fill({ text: '', style: 'tableCell', fillColor: null }),
          ];
          data.push(blankRow);
        }
        break;

      case 'emergencyGroupRoster':
        data = filteredData.map(student => {
          const fillColor = getFillColor(student);
          return [
            { text: student['Last Name'], style: 'tableCell', fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor },
            { text: student['Grade'], style: 'tableCell', fillColor },
            { text: student['Classroom'], style: 'tableCell', fillColor },
            { text: '', style: 'tableCell', fillColor },
          ];
        });
        break;

      case 'schoolRoster':
      case 'emergencySchoolRoster':
        data = filteredData.map(student => {
          const fillColor = getFillColor(student);
          return [
            { text: student['Last Name'], style: 'tableCell', fillColor },
            { text: student['First Name'], style: 'tableCell', fillColor },
            { text: student['Grade'], style: 'tableCell', fillColor },
            { text: student['Classroom'], style: 'tableCell', fillColor },
          ];
        });
        break;
    }

    return data;
  }

  function getEmergencyColor(groupName) {
    const group = APP_SETTINGS.emergencyGroupSettings.find(g => g.group === groupName);
    return group?.color || null;
  }
  
  function getEmergencyMessage() {
    return APP_SETTINGS.schoolSettings.emergencyMessage || '';
  }

  ///////////////////
  // EXPORT LABELS //
  ///////////////////

  function exportLabels() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    showActionModal("exportLabelsModal");
    const downloadLabelsModalButton = document.getElementById('downloadLabelsModalButton');
    
    downloadLabelsModalButton.onclick = function() {
      busyFlag = true;

      showToast("", "Creating labels...", 5000);
      
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

      showToast("", "Labels created successfully!", 5000);
      closeActionModal("exportLabelsModal");
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
            { text: data[i] ? data[i].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 1] ? data[i + 1].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 2] ? data[i + 2].text : '', verticalAlignment: 'middle' }
          ];
          templateBody.push(row);
        }
        break;

      case 'avery8167':
        for (let i = 0; i < data.length; i += 4) {
          let row = [
            { text: data[i] ? data[i].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 1] ? data[i + 1].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 2] ? data[i + 2].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 3] ? data[i + 3].text : '', verticalAlignment: 'middle' }
          ];
          templateBody.push(row);
        }
        break;

      case 'avery95945':
        for (let i = 0; i < data.length; i += 2) {
          let row = [
            { text: data[i] ? data[i].text : '', verticalAlignment: 'middle' },
            { text: '', style: templateType, verticalAlignment: 'middle' },
            { text: data[i + 1] ? data[i + 1].text : '', verticalAlignment: 'middle' }
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
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    showActionModal("exportDataModal");
    const exportDataModalButton = document.getElementById('exportDataModalButton');
    
    exportDataModalButton.onclick = function() {
      busyFlag = true;

      showToast("", "Exporting data...", 5000);
    
      const fileType = document.getElementById('fileTypeSelect').value;
      const fileName = 'School Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      
      switch (fileType) {
        case 'csv':
          google.script.run
            .withSuccessHandler(function(data) {
              let a = document.createElement('a');
              
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(data);
              a.download = fileName + '.csv';
              a.click();
              busyFlag = false;
              playNotificationSound("success");
              showToast("", "Data exported successfully!", 5000);
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getCsv();
        break;
        
        case 'xlsx':
          google.script.run
            .withSuccessHandler(function(data) {
              // Convert the raw data into a Uint8Array
              const uint8Array = new Uint8Array(data);
                      
              // Create a Blob from the binary data
              const blob = new Blob([uint8Array], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
              
              const url = URL.createObjectURL(blob);
              let a = document.createElement('a');
              a.href = url;
              a.download = fileName + '.xlsx';
              a.click();
              URL.revokeObjectURL(url);
              busyFlag = false;
              playNotificationSound("success");
              showToast("", "Data exported successfully!", 5000);
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getXlsx();
        break;
      }
      
      closeActionModal("exportDataModal");
    };
  }

  function showToggleFilterSidebar() {
    showSidebar("Filter Search", "toggleFilterSidebar");
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

    // Get selected search columns
    const checkboxes = document.querySelectorAll('.search-filter');
    const searchColumns = [];

    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            searchColumns.push(parseInt(checkbox.getAttribute('data-column')));
        }
    });

    // If no checkboxes are checked, search all columns
    if (searchColumns.length === 0) {
        for (let i = 0; i < checkboxes.length; i++) {
            searchColumns.push(i);
        }
    }

    // Filter table rows
    rows.forEach(row => {
        row.classList.remove('last-visible-row');
        const cells = row.querySelectorAll('td');
        let match = false;

        cells.forEach((cell, columnIndex) => {
            if (searchColumns.includes(columnIndex)) {
                let cellValue = cell.textContent.toLowerCase();

                if (cellValue.includes(query)) {
                    match = true;
                }
            }
        });

        if (match) {
            row.style.display = '';
            matchesFound++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update search results display
    if (matchesFound === 0) {
        table.style.display = 'none';
        searchResults.innerHTML = '<b>No students found!</b>';
    } else {
        table.style.display = 'table';
        searchResults.innerHTML = `<b>Students found:</b> ${matchesFound}`;

        // Add the "last-visible-row" class to the last visible row
        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        if (visibleRows.length > 0) {
            visibleRows[visibleRows.length - 1].classList.add('last-visible-row');
        }
    }
  }

  function initializeSorting() {
    const defaultColumnIndex = 0; // Default sort by "Last Name"
    sortOrder[defaultColumnIndex] = true; // (A-Z) sort

    // Add a short delay to ensure DOM is ready and table is fully rendered
    setTimeout(() => {
      const nameHeader = document.querySelector(`#schoolRoster thead th:nth-child(${defaultColumnIndex + 1})`);
      const icon = nameHeader?.querySelector(".sort-icon");
      updateSortIcons(defaultColumnIndex, sortOrder[defaultColumnIndex]);
    }, 0);
  }

  function sortTable(columnIndex) {
    const tableBody = document.querySelector("#schoolRoster tbody");
    const rows = Array.from(tableBody.querySelectorAll("tr"));

    // Store the original row order (based on first column)
    const rowNumbers = rows.map(row => row.children[0].textContent.trim());

    // If this is a new sort on this column OR we're switching to a different column,
    // start with ascending (A-Z) sort
    if (sortOrder[columnIndex] === undefined || !sortOrder.hasOwnProperty(columnIndex)) {
        sortOrder[columnIndex] = true; // (A-Z) sort
    } else {
        sortOrder[columnIndex] = !sortOrder[columnIndex];
    }

    const isAscending = sortOrder[columnIndex];

    rows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex].querySelector("input, select")?.value || rowA.children[columnIndex].textContent.trim();
        const cellB = rowB.children[columnIndex].querySelector("input, select")?.value || rowB.children[columnIndex].textContent.trim();

        if (!isNaN(cellA) && !isNaN(cellB)) {
            return isAscending ? cellA - cellB : cellB - cellA;
        }

        return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    // Reattach sorted rows
    tableBody.innerHTML = "";
    rows.forEach((row, index) => {
        tableBody.appendChild(row);
    });

    // Reset all other column sort orders except the current one
    Object.keys(sortOrder).forEach(key => {
        if (parseInt(key) !== columnIndex) {
            delete sortOrder[key];
        }
    });

    updateSortIcons(columnIndex, isAscending);
  }

  function updateSortIcons(sortedColumnIndex, isAscending) {
    document.querySelectorAll("#schoolRoster thead th i.sort-icon").forEach(icon => {
      icon.className = "bi sort-icon"; // Reset all icons
    });

    const sortedHeader = document.querySelector(`#schoolRoster thead th:nth-child(${sortedColumnIndex + 1}) i.sort-icon`);
    
    if (sortedHeader) {
      const newClass = isAscending ? "bi-caret-up-fill" : "bi-caret-down-fill";
      sortedHeader.classList.add(isAscending ? "bi-caret-up-fill" : "bi-caret-down-fill");
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
    const rosterTypeValue = rosterType.value;

    switch (rosterTypeValue) {
      case 'classRoster':
      case 'emergencyClassRoster':
        classroomSelect.style.display = 'block';
        emergencySelect.style.display = 'none';
        rosterType.style.marginBottom = '10px';
        break;

      case 'emergencyGroupRoster':
        classroomSelect.style.display = 'none';
        emergencySelect.style.display = 'block';
        rosterType.style.marginBottom = '10px';
        break;

      case 'emergencySchoolRoster':
      case 'schoolRoster':
        classroomSelect.style.display = 'none';
        emergencySelect.style.display = 'none';
        rosterType.style.marginBottom = '0';
        break;
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

      // Sync errors
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
    showAlertModal(title, message, button1, button2);
  }

  async function sessionError() {
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    const title = `${errorIcon}Session Expired`;
    const message = "The current session has expired. Please sign in with Google and try again.";
    
    playNotificationSound("alert");
    const buttonText = await showAlertModal(title, message, "Cancel", "Sign in");
       
    if (buttonText === "Sign in") {
      const signInUrl = "https://accounts.google.com";
      const signInTab = window.open(signInUrl, "_blank");
    }
  }
</script>
