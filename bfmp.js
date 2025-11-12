document.addEventListener('DOMContentLoaded', () => {
    const generatorContent = document.querySelector('.generator-content');
    if (!generatorContent) {
        console.error('Standalone BFMP generator container not found');
        return;
    }
    generatorContent.style.display = 'block';
    initBiofoulingPlanGenerator(generatorContent);
});

function initBiofoulingPlanGenerator(container) {
    const tabButtons = Array.from(container.querySelectorAll('.tab-btn'));
    const tabPanes = Array.from(container.querySelectorAll('.tab-pane'));
    const progressSteps = Array.from(container.querySelectorAll('.progress-step'));

    const previewButton = container.querySelector('#preview-plan');
    const generateButton = container.querySelector('#generate-plan');
    const planPreviewContainer = document.getElementById('plan-preview-container');
    const planPreviewModal = document.getElementById('plan-preview-modal');
    const closePreviewButton = document.getElementById('close-preview');
    const printPlanButton = document.getElementById('print-plan');
    const modalCloseButton = planPreviewModal?.querySelector('.modal-close');

    const disablePdfDownload = true;

    function activateTab(tabId) {
        tabButtons.forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
        updateProgressIndicator();
    }

    function updateProgressIndicator() {
        const activeTab = container.querySelector('.tab-btn.active');
        const activeIndex = tabButtons.indexOf(activeTab) + 1;
        progressSteps.forEach(step => {
            const stepIndex = Number(step.dataset.step);
            step.classList.toggle('active', stepIndex === activeIndex);
            step.classList.toggle('completed', stepIndex < activeIndex);
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    container.querySelectorAll('.next-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextTabId = btn.dataset.next;
            if (nextTabId) activateTab(nextTabId);
        });
    });

    container.querySelectorAll('.prev-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const prevTabId = btn.dataset.prev;
            if (prevTabId) activateTab(prevTabId);
        });
    });

    setupFileUploadPreview('diagramFiles', 'diagrams-preview');
    setupFileUploadPreview('coverPhoto', 'cover-preview');
    setupFileUploadPreview('companyLogo', 'logo-preview');

    setupDynamicSection('#add-afc', '#afc-container', '.afc-item', 'afc', updateAfcIds);
    setupDynamicSection('#add-mgps', '#mgps-container', '.mgps-item', 'mgps', updateMgpsIds);

    if (disablePdfDownload && generateButton) {
        generateButton.style.display = 'none';
        generateButton.setAttribute('aria-hidden', 'true');
    }

    if (previewButton && planPreviewContainer && planPreviewModal) {
        previewButton.addEventListener('click', () => {
            try {
                const accumulatedData = collectPlanData();
                if (!accumulatedData) return;

                const loadingIndicator = showLoadingIndicator('Generating preview...');
                setTimeout(() => {
                    try {
                        planPreviewContainer.innerHTML = generatePlanHtml(accumulatedData);
                        planPreviewModal.classList.add('active');
                    } finally {
                        hideLoadingIndicator(loadingIndicator);
                    }
                }, 250);
            } catch (error) {
                console.error('Error building preview', error);
                alert('Something went wrong while generating the preview. Please try again.');
            }
        });
    }

    if (closePreviewButton) {
        closePreviewButton.addEventListener('click', () => closeModal(planPreviewModal));
    }

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', () => closeModal(planPreviewModal));
    }

    if (planPreviewModal) {
        planPreviewModal.addEventListener('click', event => {
            if (event.target === planPreviewModal) closeModal(planPreviewModal);
        });
    }

    if (printPlanButton && planPreviewContainer) {
        printPlanButton.addEventListener('click', async () => {
            if (!planPreviewContainer.innerHTML.trim()) {
                alert('Generate a preview before printing.');
                return;
            }
            await openPrintWindow(planPreviewContainer.innerHTML);
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && planPreviewModal?.classList.contains('active')) {
            closeModal(planPreviewModal);
        }
    });

    activateTab(tabButtons[0]?.dataset.tab || 'vessel-details');
}

function setupFileUploadPreview(inputId, previewId) {
    const fileInput = document.getElementById(inputId);
    const previewContainer = document.getElementById(previewId);
    if (!fileInput || !previewContainer) return;

    fileInput.addEventListener('change', event => {
        const files = Array.from(event.target.files || []);
        previewContainer.innerHTML = '';
        if (files.length === 0) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const wrapper = document.createElement('div');
                wrapper.className = previewContainer.classList.contains('photos-preview') ? 'photo-preview' : '';

                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = previewContainer.classList.contains('photos-preview') ? 'preview-img' : 'cover-preview-img';
                    img.alt = file.name;
                    wrapper.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.textContent = file.name;
                    placeholder.className = 'placeholder-text';
                    wrapper.appendChild(placeholder);
                }

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'photo-delete-btn';
                removeButton.innerHTML = '<i class="fas fa-times"></i>';
                removeButton.addEventListener('click', () => {
                    wrapper.remove();
                    fileInput.value = '';
                });

                if (previewContainer.classList.contains('photos-preview')) {
                    wrapper.appendChild(removeButton);
                    previewContainer.appendChild(wrapper);
                } else {
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(wrapper);
                }
            };
            reader.readAsDataURL(file);
        });
    });
}

function setupDynamicSection(addButtonSelector, containerSelector, itemSelector, prefix, updateFn) {
    const addButton = document.querySelector(addButtonSelector);
    const container = document.querySelector(containerSelector);
    if (!addButton || !container) return;

    addButton.addEventListener('click', () => {
        const firstItem = container.querySelector(itemSelector);
        if (!firstItem) return;

        const clone = firstItem.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(field => {
            if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
        });
        const removeButton = clone.querySelector(`.remove-${prefix}`);
        if (removeButton) {
            removeButton.style.display = 'inline-flex';
        }
        container.appendChild(clone);
        updateFn(container);
    });

    container.addEventListener('click', event => {
        const target = event.target.closest(`.remove-${prefix}`);
        if (!target) return;
        const item = target.closest(itemSelector);
        if (!item) return;
        if (container.querySelectorAll(itemSelector).length === 1) return;
        item.remove();
        updateFn(container);
    });

    updateFn(container);
}

function updateAfcIds(container) {
    const afcItems = Array.from(container.querySelectorAll('.afc-item'));
    afcItems.forEach((item, index) => {
        const id = index + 1;
        item.dataset.afcId = String(id);
        item.querySelectorAll('label').forEach(label => {
            const forValue = label.getAttribute('for');
            if (forValue) label.setAttribute('for', forValue.replace(/\d+$/, String(id)));
        });
        item.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.tagName === 'LABEL') {
                return;
            } else {
                const newId = el.id.replace(/\d+$/, String(id));
                el.id = newId;
                if (el.name) el.name = el.name.replace(/\d+$/, String(id));
            }
        });
        const removeButton = item.querySelector('.remove-afc');
        if (removeButton) {
            removeButton.style.display = afcItems.length > 1 ? 'inline-flex' : 'none';
        }
    });
}

function updateMgpsIds(container) {
    const mgpsItems = Array.from(container.querySelectorAll('.mgps-item'));
    mgpsItems.forEach((item, index) => {
        const id = index + 1;
        item.dataset.mgpsId = String(id);
        item.querySelectorAll('label').forEach(label => {
            const forValue = label.getAttribute('for');
            if (forValue) label.setAttribute('for', forValue.replace(/\d+$/, String(id)));
        });
        item.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.tagName === 'LABEL') {
                return;
            } else {
                const newId = el.id.replace(/\d+$/, String(id));
                el.id = newId;
                if (el.name) el.name = el.name.replace(/\d+$/, String(id));
            }
        });
        const removeButton = item.querySelector('.remove-mgps');
        if (removeButton) {
            removeButton.style.display = mgpsItems.length > 1 ? 'inline-flex' : 'none';
        }
    });
}

function collectPlanData() {
    const data = {
        vessel: {
            name: getValue('vesselName'),
            imo: getValue('imoNumber'),
            constructionDate: getValue('constructionDate'),
            type: getValue('vesselType'),
            grossTonnage: getValue('grossTonnage'),
            beam: getValue('beam'),
            length: getValue('length'),
            maxDraft: getValue('maxDraft'),
            minDraft: getValue('minDraft'),
            flag: getValue('flag')
        },
        revision: {
            lastDrydock: getValue('lastDrydock'),
            nextDrydock: getValue('nextDrydock'),
            number: getValue('revisionNumber'),
            date: getValue('revisionDate'),
            responsiblePerson: getValue('responsiblePerson'),
            responsiblePosition: getValue('responsiblePosition')
        },
        operatingProfile: {
            speed: getValue('operatingSpeed'),
            inServicePeriod: getValue('inServicePeriod'),
            tradingRoutes: getValue('tradingRoutes'),
            operatingArea: getValue('operatingArea'),
            climateZones: getValue('climateZones'),
            afsSuitability: getValue('afsSuitability')
        },
        nicheAreas: {
            description: getValue('nicheAreaDescription'),
            diagrams: getFileDataUrls('diagramFiles')
        },
        afc: collectDynamicData('.afc-item', 'afc', [
            'ProductName',
            'Manufacturer',
            'Type',
            'ServiceLife',
            'Locations',
            'SuitableProfile',
            'Maintenance'
        ]),
        iafs: {
            number: getValue('iafsNumber'),
            issueDate: getValue('iafsIssueDate'),
            file: getFileDataUrl('iafsFile')
        },
        mgps: collectDynamicData('.mgps-item', 'mgps', [
            'Manufacturer',
            'Model',
            'Type',
            'ServiceLife',
            'Locations',
            'Manual'
        ]),
        afsInstallation: getValue('afsInstallation'),
        maintenance: {
            inspectionSchedule: getValue('inspectionSchedule'),
            cleaningSchedule: getValue('cleaningSchedule')
        },
        riskManagement: {
            parameters: getValue('riskParameters'),
            deviationLimits: getValue('deviationLimits'),
            contingencyActions: getValue('contingencyActions'),
            longTermActions: getValue('longTermActions')
        },
        procedures: {
            wasteManagement: getValue('wasteManagement'),
            safetyProcedures: getValue('safetyProcedures')
        },
        crewTraining: getValue('crewTraining'),
        document: {
            title: getValue('planTitle'),
            number: getValue('documentNumber'),
            revision: getValue('documentRevision'),
            format: getValue('planFormat'),
            coverPhoto: getFileDataUrl('coverPhoto'),
            companyLogo: getFileDataUrl('companyLogo')
        }
    };

    const requiredStatus = validateRequiredFields();
    if (!requiredStatus.valid) {
        const proceed = confirm(`Some sections have missing recommended fields: ${requiredStatus.sections.join(', ')}. Continue and insert placeholders for missing information?`);
        if (!proceed) return null;
    }

    return data;
}

function getValue(id) {
    const element = document.getElementById(id);
    if (!element) return '';
    if (element.type === 'checkbox') return element.checked;
    return element.value;
}

function getFileDataUrl(id) {
    const input = document.getElementById(id);
    if (!input || !input.files || input.files.length === 0) return null;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) return null;
    try {
        return URL.createObjectURL(file);
    } catch {
        return null;
    }
}

function getFileDataUrls(id) {
    const previewContainerId = document.getElementById(id)?.getAttribute('data-preview');
    if (!previewContainerId) return [];
    const previewContainer = document.getElementById(previewContainerId);
    if (!previewContainer) return [];
    return Array.from(previewContainer.querySelectorAll('img.preview-img')).map(img => img.src);
}

function collectDynamicData(selector, prefix, fields) {
    return Array.from(document.querySelectorAll(selector)).map(item => {
        const datasetId = item.dataset[`${prefix}Id`];
        return fields.reduce((acc, field) => {
            const key = field.charAt(0).toLowerCase() + field.slice(1);
            acc[key] = getValue(`${prefix}${field}${datasetId}`);
            return acc;
        }, {});
    });
}

function validateRequiredFields() {
    const sections = [
        { id: 'vessel-details', label: 'Vessel Details' },
        { id: 'operating-profile', label: 'Operating Profile' },
        { id: 'anti-fouling', label: 'Anti-fouling Systems' },
        { id: 'management', label: 'Management Procedures' },
        { id: 'generate', label: 'Generate Plan' }
    ];

    const missing = [];
    sections.forEach(section => {
        const pane = document.getElementById(section.id);
        if (!pane) return;
        const requiredFields = Array.from(pane.querySelectorAll('[required]'));
        const isMissing = requiredFields.some(field => {
            if (field.type === 'file') {
                return !field.files || field.files.length === 0;
            }
            return field.value.trim() === '';
        });
        if (isMissing) missing.push(section.label);
    });

    return { valid: missing.length === 0, sections: missing };
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

async function openPrintWindow(htmlContent) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked. Allow pop-ups to print or save the plan.');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Biofouling Management Plan</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, sans-serif; color: #333; background: #fff; }
        .report-preview { box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
        .report-header { border-bottom: 2px solid #ddd; margin-bottom: 12px; padding-bottom: 8px; }
        img { max-width: 100% !important; height: auto !important; }
        table { page-break-inside: avoid; border-collapse: collapse; width: 100%; }
        h2, h3 { page-break-after: avoid; }
        .diagram-image { page-break-inside: avoid; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        th { background: #f8fafc; }
        ul { padding-left: 1.1rem; }
        .placeholder-text { color: #555; font-style: italic; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`);
    printWindow.document.close();

    await new Promise(resolve => {
        const images = Array.from(printWindow.document.images);
        if (images.length === 0) return resolve();
        let remaining = images.length;
        images.forEach(img => {
            if (img.complete) {
                if (--remaining === 0) resolve();
            } else {
                img.onload = img.onerror = () => {
                    if (--remaining === 0) resolve();
                };
            }
        });
    });

    printWindow.focus();
    printWindow.print();
}

function showLoadingIndicator(message) {
    const indicator = document.createElement('div');
    indicator.className = 'loading-indicator';
    indicator.innerHTML = `<i class="fas fa-spinner"></i><span>${message}</span>`;
    document.body.appendChild(indicator);
    return indicator;
}

function hideLoadingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
    }
}

function generatePlanHtml(data) {
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString();
    }

    function getFieldValueOrPlaceholder(value, placeholder) {
        if (value === undefined || value === null || value === '') {
            return `<span class="placeholder-text">${placeholder}</span>`;
        }
        return value;
    }

    const planFormat = data.document.format || 'Full Plan';
    const includeBFMP = planFormat === 'Full Plan' || planFormat === 'BFMP Only';
    const includeBFRB = planFormat === 'Full Plan' || planFormat === 'BFRB Only';

    const tocItems = [];
    if (includeBFMP) {
        tocItems.push(
            '<li><a href="#intro">Introduction / Plan Overview</a></li>',
            '<li><a href="#vessel">Vessel Particulars</a></li>',
            '<li><a href="#revision">Record of Revision</a></li>',
            '<li><a href="#operating">Operating Profile</a></li>',
            '<li><a href="#niche">Hull and Niche Areas</a></li>',
            '<li><a href="#afs">Anti-fouling Systems (AFS)</a></li>',
            '<li><a href="#installation">Installation of Anti-fouling Systems</a></li>',
            '<li><a href="#inspection">Inspection Schedule</a></li>',
            '<li><a href="#cleaning">Cleaning Schedule</a></li>',
            '<li><a href="#monitoring">Monitoring of Biofouling Risk Parameters</a></li>',
            '<li><a href="#waste">Capture and Disposal of Waste</a></li>',
            '<li><a href="#safety">Safety Procedures</a></li>',
            '<li><a href="#training">Crew Training and Familiarisation</a></li>'
        );
    }
    if (includeBFRB) {
        tocItems.push('<li><a href="#recordbook">Biofouling Record Book</a></li>');
    }

    const tocHtml = `
        <h2>Index</h2>
        <div class="toc">
            <ol>${tocItems.join('')}</ol>
        </div>
    `;

    let afcHtml = '';
    if (data.afc && data.afc.length > 0) {
        afcHtml = data.afc.map((afc, index) => `
            <div class="afs-section">
                <h4>Anti-fouling Coating ${index + 1}: ${afc.productName || 'Unspecified Coating'}</h4>
                <table class="details-table">
                    <tr>
                        <th>Product Name</th>
                        <td>${getFieldValueOrPlaceholder(afc.productName, 'Enter the specific anti-fouling coating product name as per manufacturer specification.')}</td>
                        <th>Manufacturer</th>
                        <td>${getFieldValueOrPlaceholder(afc.manufacturer, 'Specify the manufacturer of the anti-fouling coating system.')}</td>
                    </tr>
                    <tr>
                        <th>Type of AFC</th>
                        <td>${getFieldValueOrPlaceholder(afc.type, 'Indicate coating type (e.g., Self-Polishing Copolymer, Hard Coating, etc.)')}</td>
                        <th>Intended Service Life</th>
                        <td>${getFieldValueOrPlaceholder(afc.serviceLife, 'Specify expected service life in years based on manufacturer recommendations.')} ${afc.serviceLife ? 'years' : ''}</td>
                    </tr>
                    <tr>
                        <th>Locations Applied</th>
                        <td colspan="3">${getFieldValueOrPlaceholder(afc.locations, 'Identify specific areas of the vessel where this coating is applied (hull areas, niche areas, etc.)')}</td>
                    </tr>
                    <tr>
                        <th>Suitable Operating Profiles</th>
                        <td colspan="3">${getFieldValueOrPlaceholder(afc.suitableProfile, 'Document operating conditions for which this coating is suitable (speed, activity/inactivity periods).')}</td>
                    </tr>
                        <tr>
                            <th>Maintenance Regime</th>
                            <td colspan="3">${getFieldValueOrPlaceholder(afc.maintenance, 'Detail the recommended maintenance procedures and schedule for this coating system.')}</td>
                        </tr>
                </table>
            </div>
        `).join('');
    } else {
        afcHtml = `
            <div class="placeholder-section">
                <p>No anti-fouling coating information has been provided. Anti-fouling coatings are critical for managing biofouling accumulation on the vessel's hull and other wetted surfaces. Please add information about all anti-fouling systems used on the vessel including product names, manufacturers, types, service life, and application areas.</p>
            </div>
        `;
    }

    let mgpsHtml = '';
    if (data.mgps && data.mgps.length > 0) {
        mgpsHtml = data.mgps.map((mgps, index) => `
            <div class="mgps-section">
                <h4>Marine Growth Prevention System ${index + 1}: ${mgps.model || 'Unspecified System'}</h4>
                <table class="details-table">
                    <tr>
                        <th>Manufacturer</th>
                        <td>${getFieldValueOrPlaceholder(mgps.manufacturer, 'Enter the manufacturer of the MGPS system.')}</td>
                        <th>Model</th>
                        <td>${getFieldValueOrPlaceholder(mgps.model, 'Specify the model name/number of the MGPS.')}</td>
                    </tr>
                    <tr>
                        <th>Type of MGPS</th>
                        <td>${getFieldValueOrPlaceholder(mgps.type, 'Indicate the type of system (Anodic, Impressed Current, Ultrasonic, etc.)')}</td>
                        <th>Service Life</th>
                        <td>${getFieldValueOrPlaceholder(mgps.serviceLife, 'Specify expected service life in years.')} ${mgps.serviceLife ? 'years' : ''}</td>
                    </tr>
                    <tr>
                        <th>Locations Installed</th>
                        <td colspan="3">${getFieldValueOrPlaceholder(mgps.locations, 'Detail where this MGPS is installed on the vessel (sea chests, internal piping, etc.)')}</td>
                    </tr>
                    <tr>
                        <th>Operating Manual Available</th>
                        <td colspan="3">${getFieldValueOrPlaceholder(mgps.manual, 'Indicate if an operating manual is available and where it is kept.')}</td>
                    </tr>
                </table>
            </div>
        `).join('');
    } else {
        mgpsHtml = `
            <div class="placeholder-section">
                <p>No Marine Growth Prevention System (MGPS) information has been provided. MGPS are important for protecting internal seawater systems from biofouling. If your vessel has MGPS installed, please provide details including manufacturer, model, type, and installation locations.</p>
            </div>
        `;
    }

    let diagramsHtml = '';
    if (data.nicheAreas.diagrams && data.nicheAreas.diagrams.length > 0) {
        diagramsHtml = data.nicheAreas.diagrams.map((diagram, index) => `
            <div class="diagram-image">
                <img src="${diagram}" alt="Vessel Diagram ${index + 1}">
                <p><strong>Diagram ${index + 1}:</strong> Areas where biofouling is likely to accumulate.</p>
            </div>
        `).join('');
    } else {
        diagramsHtml = '<p class="placeholder-section">No diagrams provided. Diagrams of the vessel showing hull and niche areas should be inserted here. These diagrams are important for identifying high-risk areas for biofouling accumulation and for planning inspection and cleaning activities.</p>';
    }

    return `
        <div class="report-preview">
            ${data.document.coverPhoto ? `
            <div class="cover-page">
                <div class="cover-image"><img src="${data.document.coverPhoto}" alt="Cover Photo"></div>
                <div class="cover-meta">
                    <h1>${data.document.title || 'Biofouling Management Plan'}</h1>
                    <p><strong>Vessel:</strong> ${getFieldValueOrPlaceholder(data.vessel.name, 'Enter vessel name')}</p>
                    <p><strong>IMO:</strong> ${getFieldValueOrPlaceholder(data.vessel.imo, 'Enter IMO number')}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
            <div class="page-break"></div>` : ''}
            <div class="report-header">
                <h1>${data.document.title || 'Biofouling Management Plan'}</h1>
                <p><strong>Document Number:</strong> ${getFieldValueOrPlaceholder(data.document.number, 'Enter a document identifier for reference')} <span class="rev-marker">Rev ${data.document.revision || '0'}</span></p>
                <p><strong>Vessel Name:</strong> ${getFieldValueOrPlaceholder(data.vessel.name, 'Enter vessel name')}</p>
                <p><strong>IMO Number:</strong> ${getFieldValueOrPlaceholder(data.vessel.imo, 'Enter IMO number')}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                ${data.document.companyLogo ? `<img src="${data.document.companyLogo}" alt="Company Logo" style="max-height: 60px; max-width: 200px; margin-top: 10px;">` : ''}
            </div>

            ${tocHtml}

            ${includeBFMP ? `
            <h2 id="intro">1. Introduction / Plan Overview</h2>
            <div class="section">
                <p>This Biofouling Management Plan has been developed to comply with the International Maritime Organization's Guidelines for the Control and Management of Ships' Biofouling to Minimise the Transfer of Invasive Aquatic Species (IMO Resolution MEPC.207(62)) and Australian national guidelines based on the Biosecurity Act 2015.</p>
                <p>Biofouling is the accumulation of aquatic organisms such as microorganisms, plants, and animals on surfaces and structures immersed in or exposed to the aquatic environment. Biofouling represents a significant pathway for the introduction and spread of invasive aquatic species, which can harm local ecosystems, impact human health, and cause economic damage.</p>
                <p>The purpose of this plan is to provide guidance on vessel-specific biofouling management measures to minimise the transfer of invasive aquatic species. This plan details operational practices and measures to be implemented to manage biofouling risks for the vessel.</p>
                <h3>1.1 Vessel Applicability</h3>
                <p>This Biofouling Management Plan applies specifically to the vessel ${getFieldValueOrPlaceholder(data.vessel.name, 'Vessel name must be entered in the Vessel Details section')}, IMO ${getFieldValueOrPlaceholder(data.vessel.imo, 'IMO number must be entered in the Vessel Details section')}.</p>
                <h3>1.2 Plan Review Schedule</h3>
                <p>This Biofouling Management Plan shall be reviewed and updated at intervals not exceeding five years, following major modifications to underwater surfaces, or when there is a significant change in the vessel's operational profile. The ${getFieldValueOrPlaceholder(data.revision.responsiblePosition, 'responsible person')} is responsible for ensuring reviews are conducted.</p>
            </div>

            <h2 id="vessel">2. Vessel Particulars</h2>
            <div class="section">
                <table class="details-table">
                    <tr>
                        <th>Vessel Name</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.name, 'Enter the full name of the vessel as shown on registration documents.')}</td>
                        <th>IMO Number</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.imo, 'Enter the unique IMO ship identification number.')}</td>
                    </tr>
                    <tr>
                        <th>Date of Construction</th>
                        <td>${formatDate(data.vessel.constructionDate) === 'N/A' ? getFieldValueOrPlaceholder('', 'Enter the date when the vessel was built.') : formatDate(data.vessel.constructionDate)}</td>
                        <th>Vessel Type</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.type, 'Indicate the vessel type (e.g., Cargo Ship, Tanker, etc.)')}</td>
                    </tr>
                    <tr>
                        <th>Gross Tonnage</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.grossTonnage, 'Enter the vessel\'s gross tonnage.')}</td>
                        <th>Beam (m)</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.beam, 'Enter the vessel\'s maximum width in meters.')}</td>
                    </tr>
                    <tr>
                        <th>Length Overall (m)</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.length, 'Enter the vessel\'s total length in meters.')}</td>
                        <th>Flag State</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.flag, 'Enter the country of vessel registration.')}</td>
                    </tr>
                    <tr>
                        <th>Maximum Draft (m)</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.maxDraft, 'Enter the vessel\'s maximum operating draft in meters.')}</td>
                        <th>Minimum Draft (m)</th>
                        <td>${getFieldValueOrPlaceholder(data.vessel.minDraft, 'Enter the vessel\'s minimum operating draft in meters.')}</td>
                    </tr>
                </table>
            </div>

            <h2 id="revision">3. Record of Revision of the BFMP</h2>
            <div class="section">
                <table class="details-table">
                    <tr>
                        <th>Date of Last Dry-docking</th>
                        <td>${formatDate(data.revision.lastDrydock) === 'N/A' ? getFieldValueOrPlaceholder('', 'Enter the date of the vessel\'s most recent dry-dock.') : formatDate(data.revision.lastDrydock)}</td>
                        <th>Date of Next Scheduled Dry-docking</th>
                        <td>${formatDate(data.revision.nextDrydock) === 'N/A' ? getFieldValueOrPlaceholder('', 'Enter the date of the vessel\'s next planned dry-dock.') : formatDate(data.revision.nextDrydock)}</td>
                    </tr>
                    <tr>
                        <th>Revision Number</th>
                        <td>${getFieldValueOrPlaceholder(data.revision.number, 'Enter the BFMP revision identifier (e.g., Rev. 1).')}</td>
                        <th>Revision Date</th>
                        <td>${formatDate(data.revision.date) === 'N/A' ? getFieldValueOrPlaceholder('', 'Enter the date of this BFMP revision.') : formatDate(data.revision.date)}</td>
                    </tr>
                    <tr>
                        <th>Responsible Person</th>
                        <td>${getFieldValueOrPlaceholder(data.revision.responsiblePerson, 'Enter the name of the person responsible for BFMP implementation.')}</td>
                        <th>Position/Role</th>
                        <td>${getFieldValueOrPlaceholder(data.revision.responsiblePosition, 'Enter the role/position of the responsible person (e.g., Chief Officer).')}</td>
                    </tr>
                </table>
            </div>

            <h2 id="operating">4. Operating Profile</h2>
            <div class="section">
                <table class="details-table">
                    <tr>
                        <th>Typical Operating Speed</th>
                        <td>${getFieldValueOrPlaceholder(data.operatingProfile.speed, 'Enter the vessel\'s typical operating speed in knots.')} ${data.operatingProfile.speed ? 'knots' : ''}</td>
                        <th>In-service Period</th>
                        <td>${getFieldValueOrPlaceholder(data.operatingProfile.inServicePeriod, 'Enter the typical duration between dry-dockings in months.')} ${data.operatingProfile.inServicePeriod ? 'months' : ''}</td>
                    </tr>
                    <tr>
                        <th>Primary Operating Area</th>
                        <td>${getFieldValueOrPlaceholder(data.operatingProfile.operatingArea, 'Specify the primary geographical region(s) where the vessel operates.')}</td>
                        <th>AFS Suitable for Operating Profile</th>
                        <td>${getFieldValueOrPlaceholder(data.operatingProfile.afsSuitability, 'Indicate whether the current anti-fouling systems are appropriate for the vessel\'s operating profile.')}</td>
                    </tr>
                </table>
                <h3>4.1 Typical Trading Routes</h3>
                <p>${getFieldValueOrPlaceholder(data.operatingProfile.tradingRoutes, 'Detail the vessel\'s regular trading routes, including common ports of call.')}</p>
                <h3>4.2 Climate Zones</h3>
                <p>${getFieldValueOrPlaceholder(data.operatingProfile.climateZones, 'Specify the climate zones where the vessel operates (e.g., tropical, temperate, polar).')}</p>
            </div>

            <h2 id="niche">5. Hull and Niche Areas Where Biofouling is Most Likely to Accumulate</h2>
            <div class="section">
                <h3>5.1 Description of Hull and Niche Areas</h3>
                <p>${getFieldValueOrPlaceholder(data.nicheAreas.description, 'Provide a detailed inventory of the vessel\'s hull and niche areas where biofouling can accumulate. Include specific information about sea chests, bow thrusters, propellers, rudders and other niche areas.')}</p>
                <h3>5.2 Location of Areas Where Biofouling is Most Likely to Accumulate</h3>
                ${diagramsHtml}
            </div>

            <h2 id="afs">6. Description of the Anti-fouling Systems (AFS)</h2>
            <div class="section">
                <h3>6.1 Anti-fouling Coatings</h3>
                ${afcHtml}
                <h3>6.2 IAFS Certificate</h3>
                <p><strong>Certificate Number:</strong> ${getFieldValueOrPlaceholder(data.iafs.number, 'Enter the International Anti-fouling System Certificate number if applicable.')}</p>
                <p><strong>Issue Date:</strong> ${formatDate(data.iafs.issueDate) === 'N/A' ? getFieldValueOrPlaceholder('', 'Enter the IAFS certificate issue date.') : formatDate(data.iafs.issueDate)}</p>
                ${data.iafs.file ? `<p><img src="${data.iafs.file}" alt="IAFS Certificate" style="max-width: 100%;"></p>` : '<p class="placeholder-text">Upload a copy of the IAFS certificate (image formats recommended) to include here.</p>'}
                <h3>6.3 Marine Growth Prevention Systems</h3>
                ${mgpsHtml}
            </div>

            <h2 id="installation">7. Installation of Anti-fouling Systems</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.afsInstallation, 'Provide comprehensive details about the installation of all anti-fouling systems on the vessel. Include information about which specific systems are applied to different areas of the vessel, coverage extent, and any areas without anti-fouling protection.')}</p>
            </div>

            <h2 id="inspection">8. Inspection Schedule</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.maintenance.inspectionSchedule, 'Document the vessel\'s planned inspection schedule for monitoring biofouling. Specify areas to be inspected, inspection frequency, methods, and recordkeeping requirements.')}</p>
            </div>

            <h2 id="cleaning">9. Cleaning Schedule</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.maintenance.cleaningSchedule, 'Detail the vessel\'s proactive cleaning schedule, including routine cleaning activities and methods used for different vessel areas.')}</p>
            </div>

            <h2 id="monitoring">10. Monitoring of Biofouling Risk Parameters and Contingency Actions</h2>
            <div class="section">
                <h3>10.1 Biofouling Risk Parameters</h3>
                <p>${getFieldValueOrPlaceholder(data.riskManagement.parameters, 'List the specific parameters that indicate increased biofouling risk (e.g., extended port stays, reduced speed operations, warm waters, freshwater exposure).')}</p>
                <h3>10.2 Evaluation Deviations and Deviation Limits</h3>
                <p>${getFieldValueOrPlaceholder(data.riskManagement.deviationLimits, 'Define the specific limits for each risk parameter that would trigger contingency actions.')}</p>
                <h3>10.3 Contingency Actions</h3>
                <p>${getFieldValueOrPlaceholder(data.riskManagement.contingencyActions, 'Specify actions to be taken when parameters exceed defined limits. Include decision criteria, responsible parties, and timelines.')}</p>
                <h3>10.4 Long-term Actions</h3>
                <p>${getFieldValueOrPlaceholder(data.riskManagement.longTermActions, 'Detail longer-term management responses following repeated or significant deviations (e.g., increase inspection frequency, update anti-fouling systems, revise the BFMP).')}</p>
            </div>

            <h2 id="waste">11. Capture and Disposal of Waste</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.procedures.wasteManagement, 'Document procedures for the capture, treatment, and disposal of biofouling waste in accordance with local and international regulations.')}</p>
            </div>

            <h2 id="safety">12. Safety Procedures for the Vessel and Crew</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.procedures.safetyProcedures, 'Detail safety procedures related to the operation and maintenance of anti-fouling systems and cleaning equipment. Include personal protective equipment requirements, operational restrictions, hazard identification, and emergency procedures.')}</p>
            </div>

            <h2 id="training">13. Crew Training and Familiarisation</h2>
            <div class="section">
                <p>${getFieldValueOrPlaceholder(data.crewTraining, 'Outline the training program for crew members involved in biofouling management activities. Specify training content, frequency, who delivers the training, and which crew members require training.')}</p>
                <h3>13.1 Training Register</h3>
                <table class="details-table">
                    <thead>
                        <tr>
                            <th>Crew Member Name</th>
                            <th>Position</th>
                            <th>Training Date</th>
                            <th>Trainer</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="4">Training register to be maintained by vessel management.</td>
                        </tr>
                    </tbody>
                </table>
            </div>` : ''}

            ${includeBFMP && includeBFRB ? '<div class="page-break"></div>' : ''}

            ${includeBFRB ? `
            <h2 id="recordbook">Biofouling Record Book</h2>
            <div class="section">
                <p>The Biofouling Record Book (BFRB) must be used in conjunction with this Biofouling Management Plan. The BFRB demonstrates that the BFMP has been implemented through records of relevant biofouling activities.</p>
                <p>The BFRB must be maintained from the date of BFMP implementation and retained for the entire service life of the vessel. Entries in the BFRB must be signed and dated by the officer or officers in charge.</p>
                <h3>Record Book Template</h3>
                <table class="details-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Activity Type</th>
                            <th>Location</th>
                            <th>Details</th>
                            <th>Person in Charge</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="5">Record of activities to be maintained here.</td>
                        </tr>
                    </tbody>
                </table>
                <p><strong>Activities to be recorded include:</strong></p>
                <ul>
                    <li>Cleaning activities</li>
                    <li>Inspections</li>
                    <li>Operation outside expected profile</li>
                    <li>AFC maintenance/service/damage</li>
                    <li>MGPS maintenance/service/downtime</li>
                </ul>
            </div>` : ''}

            <div class="footer">
                <p>This Biofouling Management Plan was generated using the standalone BFMP generator.</p>
                <p>&copy; ${new Date().getFullYear()} MarineStream Tools</p>
            </div>
        </div>
    `;
}

