import { createPuppeteerRouter, Dataset } from 'crawlee';
import { Actor } from 'apify';

export const allianzRouter = createPuppeteerRouter();

allianzRouter.addDefaultHandler(async ({ request, page, log }) => {
    const url = request.loadedUrl;
    log.info(`Processing Allianz insurance quote form: ${url}`);
    
    const startTime = new Date();
    
    try {
        // Get input data from Actor
        const input = await Actor.getInput();
        log.info('📋 Received input data:', JSON.stringify(input, null, 2));
        
        // Wait for the page to load completely
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Handle cookie notification first
        await handleCookieNotification(page, log);
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'allianz-form-start.png', fullPage: true });
        
        // Analyze the form structure
        const formInfo = await analyzeFormStructure(page, log);
        
        // Prepare form data from input (use JSON values directly)
        const formData = prepareFormDataFromJSON(input, log);
        
        // Fill out the form with enhanced handling
        const quoteResult = await fillInsuranceFormEnhanced(page, log, formData);
        
        // Prepare comprehensive output
        const automationOutput = {
            metadata: {
                url: request.loadedUrl,
                startTime: startTime.toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime.getTime(),
                actorVersion: '2.0.0',
                status: quoteResult.success ? 'SUCCESS' : 'FAILED'
            },
            inputData: formData,
            formProcessing: {
                fieldsAnalyzed: formInfo.inputs?.length || 0,
                fieldsFilled: quoteResult.filledFields?.length || 0,
                submitted: quoteResult.submitted || false,
                hasResults: quoteResult.hasResults || false,
                errors: quoteResult.errors || []
            },
            quote: quoteResult.quote || { captured: false },
            technical: {
                formStructure: formInfo,
                processedFields: quoteResult.filledFields,
                screenshots: quoteResult.screenshots || []
            }
        };
        
        await Dataset.pushData(automationOutput);
        log.info(`✅ Actor completed - Status: ${automationOutput.metadata.status}`);
        
    } catch (error) {
        log.error(`Error processing Allianz form: ${error.message}`);
        
        await Dataset.pushData({
            metadata: {
                url: request.loadedUrl,
                startTime: startTime.toISOString(),
                endTime: new Date().toISOString(),
                status: 'ERROR',
                error: error.message
            },
            quote: { captured: false, error: error.message }
        });
        
        throw error;
    }
});

async function handleCookieNotification(page, log) {
    log.info('🍪 Handling cookie notifications...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        'button:contains("Alle akzeptieren")',
        'button:contains("Akzeptieren")',
        '.onetrust-close-btn-handler'
    ];
    
    for (const selector of cookieSelectors) {
        try {
            const button = await page.$(selector);
            if (button) {
                const isVisible = await page.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }, button);
                
                if (isVisible) {
                    await page.click(selector);
                    await waitForStabilization(page, log, 1000);
                    log.info('✅ Cookie notification handled');
                    return;
                }
            }
        } catch (error) {
            continue;
        }
    }
}

function prepareFormDataFromJSON(input, log) {
    // Handle null or invalid input gracefully
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        log.warning('⚠️ No valid input data provided, using defaults for testing');
        input = {};
    }
    
    // If input is a string, try to parse it as JSON
    if (typeof input === 'string') {
        try {
            input = JSON.parse(input);
        } catch (error) {
            log.warning('⚠️ Could not parse input string as JSON, using defaults');
            input = {};
        }
    }
    
    // Use input JSON directly with safe fallbacks
    const formData = {
        // Vehicle identification
        hsn: input.hsn || "0005",
        tsn: input.tsn || "DGT",
        
        // Basic form selections
        versicherungsgrund: input.versicherungsgrund || "Neu-/Ersatz-Versicherung",
        postleitzahl: input.postleitzahl || "80331",
        nutzungDesFahrzeugs: input.nutzungDesFahrzeugs || "Privat",
        
        // Personal data
        geburtsdatumVersicherungsnehmer: input.geburtsdatumVersicherungsnehmer || "20.01.1989",
        jahrDesFuehrerscheinerwerbs: input.jahrDesFuehrerscheinerwerbs || "2012",
        berufsgruppe: input.berufsgruppe || "Allgemeine Berufsgruppen (Sonstige)",
        
        // Vehicle data
        fahrzeughalter: input.fahrzeughalter || "Ich selbst",
        erstzulassungMonat: input.erstzulassungMonat || "02",
        erstzulassungJahr: input.erstzulassungJahr || "2023",
        jahresfahrleistung: input.jahresfahrleistung || "20000",
        
        // Additional drivers
        zusaetzlicheFahrerCheckbox: input.zusaetzlicheFahrerCheckbox !== undefined ? input.zusaetzlicheFahrerCheckbox : true,
        artZusaetzlicheFahrer: input.artZusaetzlicheFahrer || "Ehe-/Lebenspartner",
        geburtsdatumJuengsterWeitererFahrer: input.geburtsdatumJuengsterWeitererFahrer || "20.01.1989",
        
        // Insurance history (conditional based on versicherungsgrund)
        schadenfreiheitsklasseOption: input.schadenfreiheitsklasseOption || "SF-Klasse aus Vorvertrag übernehmen",
        sfrAbgebendeFahrzeugVersichertBei: input.sfrAbgebendeFahrzeugVersichertBei || "Anderer Versicherer",
        sfKlasseHaftpflicht: input.sfKlasseHaftpflicht || "SF 2",
        sfKlasseVollkasko: input.sfKlasseVollkasko || "SF 0",
        
        // Claims
        schaedenReguliertLetzte3JahreCheckbox: input.schaedenReguliertLetzte3JahreCheckbox !== undefined ? input.schaedenReguliertLetzte3JahreCheckbox : true,
        anzahlRegulierterSchaeden: input.anzahlRegulierterSchaeden || "2",
        schaden1DatumMonat: input.schaden1DatumMonat || "01",
        schaden1DatumJahr: input.schaden1DatumJahr || "2023",
        schaden1Art: input.schaden1Art || "Haftpflicht",
        
        // Coverage and dates
        gewuenschterSchutz: input.gewuenschterSchutz || "Vollkasko",
        versicherungsbeginn: input.desiredStartDate || input.versicherungsbeginn || "01.06.2025" // CRITICAL: Must be future date from JSON
    };
    
    log.info('📊 Form data prepared from JSON:', JSON.stringify(formData, null, 2));
    return formData;
}

async function analyzeFormStructure(page, log) {
    log.info('🔍 Analyzing form structure...');
    
    const formElements = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea, button'));
        return {
            inputs: inputs.map(input => ({
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                value: input.value,
                classes: input.className,
                visible: input.offsetWidth > 0 && input.offsetHeight > 0
            })).filter(input => input.visible && (input.name || input.id))
        };
    });
    
    log.info(`Found ${formElements.inputs.length} visible form elements`);
    return formElements;
}

async function fillInsuranceFormEnhanced(page, log, formData) {
    try {
        log.info('🚀 Starting enhanced form filling with robust validation...');
        
        const filledFields = [];
        const errors = [];
        const screenshots = ['allianz-form-start.png'];
        
        // Step 1: Fill vehicle identification if needed
        await fillVehicleIdentification(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'vehicle-identification', screenshots);
        
        // Step 2: Fill basic information 
        await fillBasicInformation(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'basic-information', screenshots);
        
        // Step 3: Handle insurance reason selection (CRITICAL)
        await fillInsuranceReason(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'insurance-reason', screenshots);
        
        // Step 4: Fill personal data
        await fillPersonalData(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'personal-data', screenshots);
        
        // Step 5: Fill vehicle details
        await fillVehicleDetails(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'vehicle-details', screenshots);
        
        // Step 6: Conditional logic based on insurance reason
        if (formData.versicherungsgrund === "Versicherer-Wechsel") {
            log.info('🔄 Processing Versicherer-Wechsel specific fields...');
            await fillPreviousInsuranceData(page, log, formData, filledFields, errors);
            await takeStepScreenshot(page, 'previous-insurance', screenshots);
        }
        
        // Step 7: Fill coverage and dates
        await fillCoverageAndDates(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'coverage-dates', screenshots);
        
        // Step 8: Submit and capture results
        const submitResult = await submitFormAndCaptureResults(page, log, formData, filledFields, errors);
        await takeStepScreenshot(page, 'final-results', screenshots);
        
        return {
            success: submitResult.submitted && !submitResult.hasErrors,
            submitted: submitResult.submitted,
            hasResults: submitResult.hasResults,
            filledFields: filledFields,
            errors: errors,
            screenshots: screenshots,
            quote: submitResult.quote
        };
        
    } catch (error) {
        log.error(`❌ Enhanced form filling failed: ${error.message}`);
        await page.screenshot({ path: 'form-filling-error.png', fullPage: true });
        
        return {
            success: false,
            submitted: false,
            hasResults: false,
            filledFields: filledFields || [],
            errors: [error.message],
            screenshots: ['form-filling-error.png']
        };
    }
}

async function fillVehicleIdentification(page, log, formData, filledFields, errors) {
    log.info('🚗 Step 1: Vehicle identification...');
    
    if (formData.hsn && formData.tsn) {
        // Fill HSN
        const hsnFilled = await fillFieldWithValidation(page, log, {
            selectors: ['input[name*="hsn"]', '#hsn-input', 'input[placeholder*="HSN"]'],
            value: formData.hsn,
            fieldName: 'HSN',
            type: 'text'
        });
        if (hsnFilled) filledFields.push(`HSN: ${formData.hsn}`);
        
        // Fill TSN
        const tsnFilled = await fillFieldWithValidation(page, log, {
            selectors: ['input[name*="tsn"]', '#tsn-input', 'input[placeholder*="TSN"]'],
            value: formData.tsn,
            fieldName: 'TSN',
            type: 'text'
        });
        if (tsnFilled) filledFields.push(`TSN: ${formData.tsn}`);
        
        // Wait for vehicle to be loaded
        await waitForStabilization(page, log, 2000);
    }
}

async function fillBasicInformation(page, log, formData, filledFields, errors) {
    log.info('📍 Step 2: Basic information...');
    
    // Postal code
    const plzFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            'input[name*="postleitzahl"]', 
            'input[placeholder*="5-stellige"]',
            '#vnPostleitzahl-id'
        ],
        value: formData.postleitzahl,
        fieldName: 'Postleitzahl',
        type: 'text'
    });
    if (plzFilled) filledFields.push(`PLZ: ${formData.postleitzahl}`);
    
    // Vehicle usage
    const usageFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#fahrzeugnutzung-PRIVAT-id-input',
            'input[value*="PRIVAT"]'
        ],
        value: 'PRIVAT',
        fieldName: 'Fahrzeugnutzung',
        type: 'radio'
    });
    if (usageFilled) filledFields.push(`Nutzung: ${formData.nutzungDesFahrzeugs}`);
}

async function fillInsuranceReason(page, log, formData, filledFields, errors) {
    log.info('⚖️ Step 3: Insurance reason (CRITICAL)...');
    
    const reasonValue = formData.versicherungsgrund;
    log.info(`📋 Using insurance reason from JSON: ${reasonValue}`);
    
    let selectorMapping = {};
    if (reasonValue === "Neu-/Ersatz-Versicherung") {
        selectorMapping = {
            selectors: [
                '#situation-NEUES_FAHRZEUG-id-input',
                'input[value*="NEUES_FAHRZEUG"]',
                'input[value*="NEU"]'
            ],
            value: 'NEUES_FAHRZEUG',
            fieldName: 'Neu-/Ersatz-Versicherung',
            type: 'radio'
        };
    } else if (reasonValue === "Versicherer-Wechsel") {
        selectorMapping = {
            selectors: [
                '#situation-WECHSEL-id-input',
                'input[value*="WECHSEL"]',
                'input[value*="VERSICHERER_WECHSEL"]'
            ],
            value: 'WECHSEL',
            fieldName: 'Versicherer-Wechsel',
            type: 'radio'
        };
    }
    
    if (selectorMapping.selectors) {
        const reasonFilled = await fillFieldWithValidation(page, log, selectorMapping);
        if (reasonFilled) {
            filledFields.push(`Versicherungsgrund: ${reasonValue}`);
            // CRITICAL: Wait for form to adapt to this selection
            await waitForStabilization(page, log, 3000);
        } else {
            errors.push(`Could not select insurance reason: ${reasonValue}`);
        }
    }
}

async function fillPersonalData(page, log, formData, filledFields, errors) {
    log.info('👤 Step 4: Personal data...');
    
    // Birth date
    const birthDateFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#geburtsdatum-id',
            'input[name*="geburtsdatum"]',
            'input[type="date"]'
        ],
        value: formData.geburtsdatumVersicherungsnehmer,
        fieldName: 'Geburtsdatum',
        type: 'date'
    });
    if (birthDateFilled) filledFields.push(`Geburtsdatum: ${formData.geburtsdatumVersicherungsnehmer}`);
    
    // License year
    const licenseFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#fuehrerscheinerwerbsdatumVn23Year',
            'input[name*="fuehrerschein"]',
            'input[placeholder*="JJJJ"]'
        ],
        value: formData.jahrDesFuehrerscheinerwerbs,
        fieldName: 'Führerschein Jahr',
        type: 'text'
    });
    if (licenseFilled) filledFields.push(`Führerschein: ${formData.jahrDesFuehrerscheinerwerbs}`);
    
    // Professional group - ENHANCED with form structure analysis
    let professionFilled = false;
    log.info('🏢 Attempting professional group selection...');
    
    // Wait for professional group field to appear (might be conditional)
    await waitForStabilization(page, log, 2000);
    
    // Try to find any dropdown or select related to profession/occupation
    try {
        const professionElements = await page.evaluate(() => {
            const elements = [];
            // Look for select elements
            const selects = document.querySelectorAll('select');
            selects.forEach(select => {
                const context = (select.name + ' ' + select.id + ' ' + select.className).toLowerCase();
                if (context.includes('beruf') || context.includes('profession') || context.includes('occupation')) {
                    elements.push({
                        type: 'select',
                        selector: select.id ? `#${select.id}` : `select[name="${select.name}"]`,
                        context: context
                    });
                }
            });
            
            // Look for radio buttons related to profession
            const radios = document.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
                const labelText = label ? label.textContent.trim() : '';
                const context = (radio.name + ' ' + radio.value + ' ' + labelText).toLowerCase();
                if (context.includes('beruf') || context.includes('allgemein') || context.includes('sonstige')) {
                    elements.push({
                        type: 'radio',
                        selector: radio.id ? `#${radio.id}` : `input[name="${radio.name}"][value="${radio.value}"]`,
                        context: context,
                        labelText: labelText
                    });
                }
            });
            
            return elements;
        });
        
        log.info(`Found ${professionElements.length} potential profession elements`);
        
        // Try each profession element
        for (const element of professionElements) {
            if (element.type === 'select') {
                const options = await page.evaluate(selector => {
                    const select = document.querySelector(selector);
                    if (select) {
                        return Array.from(select.options).map(opt => ({
                            value: opt.value,
                            text: opt.textContent.trim()
                        }));
                    }
                    return [];
                }, element.selector);
                
                const matchingOption = options.find(opt => 
                    opt.text.toLowerCase().includes('allgemein') || 
                    opt.text.toLowerCase().includes('sonstige') ||
                    opt.text.toLowerCase().includes('andere')
                );
                
                if (matchingOption) {
                    await page.select(element.selector, matchingOption.value);
                    await waitForStabilization(page, log, 1000);
                    professionFilled = true;
                    filledFields.push(`Berufsgruppe: ${matchingOption.text}`);
                    log.info(`✅ Professional group selected via dropdown: ${matchingOption.text}`);
                    break;
                }
            } else if (element.type === 'radio') {
                await page.click(element.selector);
                await waitForStabilization(page, log, 1000);
                const isChecked = await page.evaluate(sel => {
                    const radio = document.querySelector(sel);
                    return radio ? radio.checked : false;
                }, element.selector);
                if (isChecked) {
                    professionFilled = true;
                    filledFields.push(`Berufsgruppe: ${element.labelText || 'Allgemein'}`);
                    log.info(`✅ Professional group selected via radio: ${element.labelText}`);
                    break;
                }
            }
        }
    } catch (error) {
        log.warning(`Professional group selection error: ${error.message}`);
    }
    
    if (!professionFilled) {
        log.warning('⚠️ Professional group field may not be visible yet or requires different approach');
    }
    
    // Driver circle/additional drivers - ENHANCED
    if (formData.zusaetzlicheFahrerCheckbox) {
        const additionalDriversFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#fahrerkreis-BELIEBIGE-id-input',
                'input[value*="BELIEBIGE"]',
                'input[name="fahrerkreis-radio-group"][value="on"]'
            ],
            value: 'BELIEBIGE',
            fieldName: 'Zusätzliche Fahrer',
            type: 'radio'
        });
        if (additionalDriversFilled) {
            filledFields.push(`Zusätzliche Fahrer: Ja`);
            
            // Wait for additional driver fields to appear
            await waitForStabilization(page, log, 2000);
            
            // Look for youngest driver birth date field that appears conditionally
            if (formData.geburtsdatumJuengsterWeitererFahrer) {
                const youngDriverFields = await page.evaluate(() => {
                    const inputs = document.querySelectorAll('input[type="text"], input[type="date"]');
                    return Array.from(inputs)
                        .filter(input => input.offsetWidth > 0 && input.offsetHeight > 0)
                        .map(input => ({
                            id: input.id,
                            name: input.name,
                            placeholder: input.placeholder,
                            context: (input.name + ' ' + input.id + ' ' + input.placeholder).toLowerCase()
                        }))
                        .filter(field => 
                            field.context.includes('fahrer') || 
                            field.context.includes('geburt') ||
                            field.context.includes('driver') ||
                            field.context.includes('youngest')
                        );
                });
                
                for (const field of youngDriverFields) {
                    const selector = field.id ? `#${field.id}` : `input[name="${field.name}"]`;
                    const filled = await fillFieldWithValidation(page, log, {
                        selectors: [selector],
                        value: formData.geburtsdatumJuengsterWeitererFahrer,
                        fieldName: 'Geburtsdatum jüngster Fahrer',
                        type: 'date'
                    });
                    if (filled) {
                        filledFields.push(`Jüngster Fahrer: ${formData.geburtsdatumJuengsterWeitererFahrer}`);
                        break;
                    }
                }
            }
        }
    } else {
        // Only main driver
        const singleDriverFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#fahrerkreis-VN-id-input',
                'input[value*="VN"]'
            ],
            value: 'VN',
            fieldName: 'Nur Versicherungsnehmer',
            type: 'radio'
        });
        if (singleDriverFilled) filledFields.push(`Fahrerkreis: Nur VN`);
    }
}

async function fillVehicleDetails(page, log, formData, filledFields, errors) {
    log.info('🔧 Step 5: Vehicle details...');
    
    // Vehicle owner - ENHANCED to handle conditional appearance
    let ownerFilled = false;
    log.info('🚗 Looking for vehicle owner field...');
    
    // Wait for vehicle owner field to appear (might be conditional)
    await waitForStabilization(page, log, 2000);
    
    // Look for vehicle owner fields
    const ownerFields = await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        return Array.from(radios)
            .filter(radio => radio.offsetWidth > 0 && radio.offsetHeight > 0)
            .map(radio => {
                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
                const labelText = label ? label.textContent.trim() : '';
                return {
                    id: radio.id,
                    name: radio.name,
                    value: radio.value,
                    labelText: labelText,
                    context: (radio.name + ' ' + radio.value + ' ' + labelText).toLowerCase()
                };
            })
            .filter(field => 
                field.context.includes('halter') || 
                field.context.includes('owner') ||
                field.context.includes('selbst') ||
                field.context.includes('ich')
            );
    });
    
    log.info(`Found ${ownerFields.length} potential vehicle owner fields`);
    
    for (const field of ownerFields) {
        if (field.context.includes('selbst') || field.context.includes('ich') || field.context.includes('vn')) {
            const selector = field.id ? `#${field.id}` : `input[name="${field.name}"][value="${field.value}"]`;
            ownerFilled = await fillFieldWithValidation(page, log, {
                selectors: [selector],
                value: 'ICH_SELBST',
                fieldName: 'Fahrzeughalter',
                type: 'radio'
            });
            if (ownerFilled) {
                filledFields.push(`Fahrzeughalter: ${field.labelText || 'Ich selbst'}`);
                log.info(`✅ Vehicle owner selected: ${field.labelText}`);
                break;
            }
        }
    }
    
    if (!ownerFilled) {
        // Try traditional selectors as fallback
        ownerFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#fahrzeughalter-ICH_SELBST-input',
                'input[value*="ICH_SELBST"]',
                'input[value*="VN"]',
                'input[name*="fahrzeughalter"]'
            ],
            value: 'ICH_SELBST',
            fieldName: 'Fahrzeughalter',
            type: 'radio'
        });
        if (ownerFilled) filledFields.push(`Fahrzeughalter: ${formData.fahrzeughalter}`);
    }
    
    // Registration dates - USING EXACT IDs FROM FORM STRUCTURE
    const regMonthFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#erstzulassungMonth',
            'input[name="erstzulassung-name"][placeholder="MM"]'
        ],
        value: formData.erstzulassungMonat,
        fieldName: 'Erstzulassung Monat',
        type: 'text'
    });
    
    const regYearFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#erstzulassungYear',
            'input[name="erstzulassung-name"][placeholder="JJJJ"]'
        ],
        value: formData.erstzulassungJahr,
        fieldName: 'Erstzulassung Jahr',
        type: 'text'
    });
    
    if (regMonthFilled && regYearFilled) {
        filledFields.push(`Erstzulassung: ${formData.erstzulassungMonat}.${formData.erstzulassungJahr}`);
    }
    
    // New vehicle checkbox (if applicable)
    if (!formData.neufahrzeugCheckbox) {
        const newVehicleFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#nx-checkbox-neuwagen-id',
                'input[name="neuwagen-name"]'
            ],
            value: false,
            fieldName: 'Neuwagen',
            type: 'checkbox'
        });
        if (newVehicleFilled) filledFields.push(`Neuwagen: Nein`);
    }
    
    // Annual mileage (FIXED: Convert to thousands) - USING EXACT ID
    const mileageInThousands = Math.round(parseInt(formData.jahresfahrleistung) / 1000).toString();
    log.info(`📊 Converting annual mileage from ${formData.jahresfahrleistung} to ${mileageInThousands} (thousands)`);
    
    const mileageFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#jahresfahrleistung-id',
            'input[name="jahresfahrleistung-name"]'
        ],
        value: mileageInThousands,
        fieldName: 'Jahresfahrleistung',
        type: 'text'
    });
    if (mileageFilled) filledFields.push(`Jahresfahrleistung: ${mileageInThousands} (${formData.jahresfahrleistung} km)`);
    
    // Vehicle license plate type - USING EXACT IDs
    log.info('🏷️ Setting license plate type...');
    const plateTypeFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#kennzeichenart-NORMAL-id-input'
        ],
        value: 'NORMAL',
        fieldName: 'Kennzeichenart',
        type: 'radio'
    });
    if (plateTypeFilled) filledFields.push(`Kennzeichenart: Standard`);
    
    // Seasonal license plate - USING EXACT IDs  
    log.info('📅 Setting seasonal license plate...'); 
    const seasonalFilled = await fillFieldWithValidation(page, log, {
        selectors: [
            '#kennzeichenSaison-NEIN-id-input'
        ],
        value: 'NEIN',
        fieldName: 'Saisonkennzeichen',
        type: 'radio'
    });
    if (seasonalFilled) filledFields.push(`Saisonkennzeichen: Nein`);
}

async function fillPreviousInsuranceData(page, log, formData, filledFields, errors) {
    log.info('📋 Step 6: Previous insurance data (Versicherer-Wechsel)...');
    
    // Registration to you date (Zulassung auf Sie)
    if (formData.erstzulassungMonat && formData.erstzulassungJahr) {
        const regMonthFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#erstzulassungVnMonth',
                'input[name*="erstzulassungVn"][placeholder*="MM"]'
            ],
            value: formData.erstzulassungMonat,
            fieldName: 'Zulassung Monat',
            type: 'text'
        });
        
        const regYearFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#erstzulassungVnYear',
                'input[name*="erstzulassungVn"][placeholder*="JJJJ"]'
            ],
            value: formData.erstzulassungJahr,
            fieldName: 'Zulassung Jahr',
            type: 'text'
        });
        
        if (regMonthFilled && regYearFilled) {
            filledFields.push(`Zulassung auf Sie: ${formData.erstzulassungMonat}.${formData.erstzulassungJahr}`);
        }
    }
    
    // Previous insurer
    if (formData.sfrAbgebendeFahrzeugVersichertBei) {
        await handlePreviousInsurerSelection(page, log, formData, filledFields, errors);
    }
}

async function fillCoverageAndDates(page, log, formData, filledFields, errors) {
    log.info('🛡️ Step 7: Coverage and dates...');
    
    // SF class handling (if applicable based on insurance reason) - USING EXACT IDs
    if (formData.versicherungsgrund === "Neu-/Ersatz-Versicherung" || formData.versicherungsgrund === "Versicherer-Wechsel") {
        // SF class selection - ENHANCED
        const sfClassFilled = await fillFieldWithValidation(page, log, {
            selectors: [
                '#sfEinstufung-VORVERTRAG-id-input',
                'input[name="sfEinstufung-radio-group"][value="on"]'
            ],
            value: 'VORVERTRAG',
            fieldName: 'SF-Klasse Einstufung',
            type: 'radio'
        });
        if (sfClassFilled) {
            filledFields.push(`SF-Klasse: Aus Vorvertrag`);
            await waitForStabilization(page, log, 2000);
            
            // Look for SF class detail fields that appear conditionally
            log.info('🔍 Looking for SF class detail fields...');
            const sfDetailFields = await page.evaluate(() => {
                const selects = document.querySelectorAll('select');
                const radios = document.querySelectorAll('input[type="radio"]');
                const fields = [];
                
                // Check select elements
                selects.forEach(select => {
                    if (select.offsetWidth > 0 && select.offsetHeight > 0) {
                        const context = (select.name + ' ' + select.id + ' ' + select.className).toLowerCase();
                        if (context.includes('sf') || context.includes('schadenfreiheit') || context.includes('haftpflicht') || context.includes('vollkasko')) {
                            fields.push({
                                type: 'select',
                                selector: select.id ? `#${select.id}` : `select[name="${select.name}"]`,
                                context: context
                            });
                        }
                    }
                });
                
                // Check radio buttons for SF classes
                radios.forEach(radio => {
                    if (radio.offsetWidth > 0 && radio.offsetHeight > 0) {
                        const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
                        const labelText = label ? label.textContent.trim() : '';
                        const context = (radio.name + ' ' + radio.value + ' ' + labelText).toLowerCase();
                        if (context.includes('sf') && (context.includes('2') || context.includes('0'))) {
                            fields.push({
                                type: 'radio',
                                selector: radio.id ? `#${radio.id}` : `input[name="${radio.name}"][value="${radio.value}"]`,
                                context: context,
                                labelText: labelText
                            });
                        }
                    }
                });
                
                return fields;
            });
            
            log.info(`Found ${sfDetailFields.length} SF detail fields`);
            
            // Fill SF class details
            for (const field of sfDetailFields) {
                if (field.type === 'select') {
                    if (field.context.includes('haftpflicht') && formData.sfKlasseHaftpflicht) {
                        const options = await page.evaluate(selector => {
                            const select = document.querySelector(selector);
                            if (select) {
                                return Array.from(select.options).map(opt => ({
                                    value: opt.value,
                                    text: opt.textContent.trim()
                                }));
                            }
                            return [];
                        }, field.selector);
                        
                        const matchingOption = options.find(opt => 
                            opt.text.includes('SF 2') || opt.value.includes('2')
                        );
                        
                        if (matchingOption) {
                            await page.select(field.selector, matchingOption.value);
                            await waitForStabilization(page, log, 1000);
                            filledFields.push(`SF Haftpflicht: ${matchingOption.text}`);
                        }
                    } else if (field.context.includes('vollkasko') && formData.sfKlasseVollkasko) {
                        const options = await page.evaluate(selector => {
                            const select = document.querySelector(selector);
                            if (select) {
                                return Array.from(select.options).map(opt => ({
                                    value: opt.value,
                                    text: opt.textContent.trim()
                                }));
                            }
                            return [];
                        }, field.selector);
                        
                        const matchingOption = options.find(opt => 
                            opt.text.includes('SF 0') || opt.value.includes('0')
                        );
                        
                        if (matchingOption) {
                            await page.select(field.selector, matchingOption.value);
                            await waitForStabilization(page, log, 1000);
                            filledFields.push(`SF Vollkasko: ${matchingOption.text}`);
                        }
                    }
                } else if (field.type === 'radio') {
                    // Handle radio SF class selections
                    if (field.context.includes('sf 2') && formData.sfKlasseHaftpflicht) {
                        await page.click(field.selector);
                        await waitForStabilization(page, log, 1000);
                        filledFields.push(`SF Haftpflicht: ${field.labelText}`);
                    } else if (field.context.includes('sf 0') && formData.sfKlasseVollkasko) {
                        await page.click(field.selector);
                        await waitForStabilization(page, log, 1000);
                        filledFields.push(`SF Vollkasko: ${field.labelText}`);
                    }
                }
            }
        }
    }
    
    // Coverage type - ENHANCED to find the actual coverage field
    log.info('🛡️ Looking for coverage type fields...');
    const coverageFields = await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        return Array.from(radios)
            .filter(radio => radio.offsetWidth > 0 && radio.offsetHeight > 0)
            .map(radio => {
                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
                const labelText = label ? label.textContent.trim() : '';
                return {
                    id: radio.id,
                    name: radio.name,
                    value: radio.value,
                    labelText: labelText,
                    context: (radio.name + ' ' + radio.value + ' ' + labelText).toLowerCase()
                };
            })
            .filter(field => 
                field.context.includes('deckung') || 
                field.context.includes('vollkasko') ||
                field.context.includes('haftpflicht') ||
                field.context.includes('teilkasko') ||
                field.context.includes('coverage')
            );
    });
    
    let coverageFilled = false;
    for (const field of coverageFields) {
        if (field.context.includes('vollkasko') && formData.gewuenschterSchutz === 'Vollkasko') {
            const selector = field.id ? `#${field.id}` : `input[name="${field.name}"][value="${field.value}"]`;
            coverageFilled = await fillFieldWithValidation(page, log, {
                selectors: [selector],
                value: 'VOLLKASKO',
                fieldName: 'Deckung',
                type: 'radio'
            });
            if (coverageFilled) {
                filledFields.push(`Deckung: ${field.labelText || formData.gewuenschterSchutz}`);
                break;
            }
        }
    }
    
    // Claims history - ENHANCED
    log.info('📋 Looking for claims history fields...');
    const claimFields = await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        return Array.from(radios)
            .filter(radio => radio.offsetWidth > 0 && radio.offsetHeight > 0)
            .map(radio => {
                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
                const labelText = label ? label.textContent.trim() : '';
                return {
                    id: radio.id,
                    name: radio.name,
                    value: radio.value,
                    labelText: labelText,
                    context: (radio.name + ' ' + radio.value + ' ' + labelText).toLowerCase()
                };
            })
            .filter(field => 
                field.context.includes('schaden') || 
                field.context.includes('claim') ||
                field.context.includes('unfall') ||
                field.labelText.toLowerCase().includes('schaden')
            );
    });
    
    if (formData.schaedenReguliertLetzte3JahreCheckbox) {
        // Look for "Yes" option for claims
        for (const field of claimFields) {
            if (field.context.includes('ja') || field.labelText.toLowerCase().includes('ja')) {
                const selector = field.id ? `#${field.id}` : `input[name="${field.name}"][value="${field.value}"]`;
                const claimsFilled = await fillFieldWithValidation(page, log, {
                    selectors: [selector],
                    value: 'JA',
                    fieldName: 'Schäden letzten 3 Jahre',
                    type: 'radio'
                });
                if (claimsFilled) {
                    filledFields.push(`Schäden: Ja (${formData.anzahlRegulierterSchaeden})`);
                    break;
                }
            }
        }
    } else {
        // Look for "No" option for claims
        for (const field of claimFields) {
            if (field.context.includes('nein') || field.labelText.toLowerCase().includes('nein')) {
                const selector = field.id ? `#${field.id}` : `input[name="${field.name}"][value="${field.value}"]`;
                const noClaimsFilled = await fillFieldWithValidation(page, log, {
                    selectors: [selector],
                    value: 'NEIN',
                    fieldName: 'Keine Schäden',
                    type: 'radio'
                });
                if (noClaimsFilled) {
                    filledFields.push(`Schäden: Nein`);
                    break;
                }
            }
        }
    }
    
    // CRITICAL: Insurance start date (MUST BE FUTURE DATE FROM JSON) - SUPER ENHANCED
    if (formData.versicherungsbeginn) {
        log.info(`📅 CRITICAL: Setting insurance start date: ${formData.versicherungsbeginn}`);
        
        // Wait for any dynamic content to load
        await waitForStabilization(page, log, 3000);
        
        // Try to find ANY input field that could be the date field by analyzing ALL inputs
        const allInputFields = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            return Array.from(inputs)
                .filter(input => input.offsetWidth > 0 && input.offsetHeight > 0)
                .map(input => ({
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    placeholder: input.placeholder,
                    value: input.value,
                    className: input.className,
                    context: (input.name + ' ' + input.id + ' ' + input.placeholder + ' ' + input.className).toLowerCase()
                }))
                .filter(field => 
                    field.type === 'date' ||
                    field.type === 'text' ||
                    field.context.includes('versicherung') || 
                    field.context.includes('beginn') ||
                    field.context.includes('start') ||
                    field.context.includes('datum') ||
                    field.context.includes('gueltig') ||
                    field.context.includes('ab') ||
                    field.placeholder.includes('datum') ||
                    field.placeholder.includes('TT.MM') ||
                    field.placeholder.includes('DD.MM')
                );
        });
        
        log.info(`🔍 Found ${allInputFields.length} potential date input fields`);
        allInputFields.forEach((field, index) => {
            log.info(`   ${index + 1}. ID: ${field.id}, Name: ${field.name}, Type: ${field.type}, Placeholder: ${field.placeholder}`);
        });
        
        let startDateFilled = false;
        
        // Enhanced date filling strategy
        for (const field of allInputFields) {
            if (startDateFilled) break;
            
            const selector = field.id ? `#${field.id}` : (field.name ? `input[name="${field.name}"]` : null);
            if (!selector) continue;
            
            log.info(`🎯 Attempting to fill date field: ${selector}`);
            
            // Try multiple date formats and methods
            const dateFormats = [
                formData.versicherungsbeginn, // DD.MM.YYYY
                convertToISODate(formData.versicherungsbeginn), // YYYY-MM-DD
                formData.versicherungsbeginn.replace(/\./g, '/'), // DD/MM/YYYY
                formData.versicherungsbeginn.replace(/\./g, '-') // DD-MM-YYYY
            ].filter(Boolean);
            
            for (const dateFormat of dateFormats) {
                if (startDateFilled) break;
                
                try {
                    // Method 1: Focus, clear, type with events
                    await page.focus(selector);
                    await page.evaluate(sel => {
                        const element = document.querySelector(sel);
                        if (element) {
                            element.value = '';
                            element.dispatchEvent(new Event('focus', { bubbles: true }));
                        }
                    }, selector);
                    
                    await page.type(selector, dateFormat, { delay: 150 });
                    
                    // Trigger comprehensive events
                    await page.evaluate((sel, val) => {
                        const element = document.querySelector(sel);
                        if (element) {
                            element.value = val;
                            // Trigger all possible events
                            ['input', 'change', 'blur', 'keyup', 'keydown'].forEach(eventType => {
                                element.dispatchEvent(new Event(eventType, { bubbles: true }));
                            });
                            
                            // Trigger Angular events if present
                            if (window.angular) {
                                element.dispatchEvent(new Event('ng-change', { bubbles: true }));
                            }
                        }
                    }, selector, dateFormat);
                    
                    await waitForStabilization(page, log, 1500);
                    
                    // Verify the value was set
                    const actualValue = await page.evaluate(sel => {
                        const element = document.querySelector(sel);
                        return element ? element.value : '';
                    }, selector);
                    
                    if (actualValue && (actualValue === dateFormat || actualValue.includes(dateFormat.substring(0, 5)))) {
                        log.info(`✅ Insurance start date successfully set: ${actualValue}`);
                        filledFields.push(`Versicherungsbeginn: ${formData.versicherungsbeginn}`);
                        startDateFilled = true;
                        break;
                    } else {
                        log.info(`❌ Date value not registered. Expected: ${dateFormat}, Got: ${actualValue}`);
                    }
                    
                } catch (error) {
                    log.warning(`Date filling attempt failed: ${error.message}`);
                    continue;
                }
            }
        }
        
        if (!startDateFilled) {
            log.error(`❌ CRITICAL: All date field attempts failed for: ${formData.versicherungsbeginn}`);
            errors.push(`CRITICAL: Could not set insurance start date: ${formData.versicherungsbeginn}`);
            
            // Take debugging screenshot
            await page.screenshot({ path: 'date-field-debug.png', fullPage: true });
        }
    }
}

function convertToISODate(germanDate) {
    try {
        // Convert DD.MM.YYYY to YYYY-MM-DD
        const parts = germanDate.split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
    } catch (error) {
        return null;
    }
    return null;
}

async function handlePreviousInsurerSelection(page, log, formData, filledFields, errors) {
    log.info('🏢 Handling previous insurer selection...');
    
    // Wait for popup to appear
    await waitForStabilization(page, log, 2000);
    
    const previousInsurer = formData.sfrAbgebendeFahrzeugVersichertBei;
    log.info(`🏢 Looking for previous insurer: ${previousInsurer}`);
    
    // Look for specific insurer or "Anderer Versicherer"
    const insurerOptions = await page.evaluate((insurer) => {
        const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
        const options = [];
        
        radioButtons.forEach(radio => {
            if (radio.offsetWidth > 0 && radio.offsetHeight > 0) {
                let labelText = '';
                if (radio.id) {
                    const label = document.querySelector(`label[for="${radio.id}"]`);
                    if (label) labelText = label.textContent.trim();
                }
                
                const context = (labelText + ' ' + radio.value + ' ' + radio.name).toLowerCase();
                options.push({
                    radio: radio,
                    labelText: labelText,
                    context: context,
                    selector: radio.id ? `#${radio.id}` : `[name="${radio.name}"][value="${radio.value}"]`
                });
            }
        });
        
        return options.map(opt => ({
            labelText: opt.labelText,
            context: opt.context,
            selector: opt.selector
        }));
    }, previousInsurer);
    
    log.info(`Found ${insurerOptions.length} insurer options`);
    
    // Select appropriate option
    let selectedOption = null;
    
    // First try exact match
    for (const option of insurerOptions) {
        if (option.context.includes(previousInsurer.toLowerCase())) {
            selectedOption = option;
            break;
        }
    }
    
    // Fallback to "andere" or "anderer versicherer"
    if (!selectedOption) {
        for (const option of insurerOptions) {
            if (option.context.includes('andere') || option.context.includes('sonstige')) {
                selectedOption = option;
                break;
            }
        }
    }
    
    if (selectedOption) {
        const insurerFilled = await fillFieldWithValidation(page, log, {
            selectors: [selectedOption.selector],
            value: 'selected',
            fieldName: 'Bisheriger Versicherer',
            type: 'radio'
        });
        if (insurerFilled) {
            filledFields.push(`Bisheriger Versicherer: ${selectedOption.labelText}`);
        }
    } else {
        errors.push(`Could not find previous insurer option: ${previousInsurer}`);
    }
}

async function submitFormAndCaptureResults(page, log, formData, filledFields, errors) {
    log.info('🎯 Step 8: Final submission and results capture...');
    
    // Take screenshot before submission
    await page.screenshot({ path: 'before-final-submit.png', fullPage: true });
    
    // Look for submit button
    const submitSelectors = [
        'button:contains("JETZT berechnen")',
        'button:contains("Jetzt berechnen")',
        'button:contains("Berechnen")',
        '[class*="berechnen"]'
    ];
    
    let submitted = false;
    let hasResults = false;
    let hasErrors = false;
    let quote = null;
    
    for (const selector of submitSelectors) {
        try {
            let submitButton;
            if (selector.includes(':contains')) {
                const text = selector.match(/contains\("([^"]+)"\)/)[1];
                submitButton = await page.evaluateHandle((text) => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(button => button.textContent.includes(text));
                }, text);
                
                if (submitButton.asElement()) {
                    submitButton = submitButton.asElement();
                } else {
                    continue;
                }
            } else {
                submitButton = await page.$(selector);
            }
            
            if (submitButton) {
                const isClickable = await page.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0 && !el.disabled;
                }, submitButton);
                
                if (isClickable) {
                    log.info(`🎯 Found submit button: ${selector}`);
                    await submitButton.click();
                    submitted = true;
                    
                    // Wait for results
                    await waitForStabilization(page, log, 5000);
                    
                    // Take screenshot of results
                    await page.screenshot({ path: 'quote-results.png', fullPage: true });
                    
                    // Check for results
                    const pageContent = await page.evaluate(() => document.body.textContent);
                    hasResults = pageContent.includes('Tarif') || pageContent.includes('€') || pageContent.includes('Angebot');
                    hasErrors = pageContent.includes('Fehler') || pageContent.includes('Error');
                    
                    // Capture quote data
                    quote = await captureQuoteData(page, log);
                    
                    break;
                }
            }
        } catch (error) {
            log.warning(`Could not click submit button ${selector}: ${error.message}`);
            continue;
        }
    }
    
    return {
        submitted: submitted,
        hasResults: hasResults,
        hasErrors: hasErrors,
        quote: quote
    };
}

// CRITICAL: Enhanced field filling with proper validation
async function fillFieldWithValidation(page, log, fieldConfig) {
    const { selectors, value, fieldName, type } = fieldConfig;
    
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await page.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }, element);
                
                if (isVisible) {
                    log.info(`📝 Filling ${fieldName} with: ${value}`);
                    
                    if (type === 'radio') {
                        // For radio buttons: click and wait for registration
                        await element.click();
                        await waitForStabilization(page, log, 1000);
                        
                        // Verify selection was registered
                        const isChecked = await page.evaluate(el => el.checked, element);
                        if (isChecked) {
                            log.info(`✅ ${fieldName} successfully selected`);
                            return true;
                        } else {
                            log.warning(`⚠️ ${fieldName} selection not registered`);
                        }
                        
                    } else if (type === 'select') {
                        // For select elements: select option and verify
                        try {
                            if (selector.includes('select')) {
                                await page.select(selector, value);
                            } else {
                                // Handle by clicking option
                                await element.click();
                            }
                            await waitForStabilization(page, log, 1000);
                            
                            const selectedValue = await page.evaluate((sel, val) => {
                                const selectEl = document.querySelector(sel);
                                if (selectEl && selectEl.tagName === 'SELECT') {
                                    return selectEl.value === val || selectEl.selectedOptions[0]?.textContent.includes(val);
                                }
                                return true; // For non-select elements that were clicked
                            }, selector, value);
                            
                            if (selectedValue) {
                                log.info(`✅ ${fieldName} successfully selected`);
                                return true;
                            } else {
                                log.warning(`⚠️ ${fieldName} selection not registered`);
                            }
                        } catch (selectError) {
                            log.warning(`Select error for ${fieldName}: ${selectError.message}`);
                        }
                        
                    } else if (type === 'text' || type === 'date') {
                        // For text/date: focus, clear, type, blur, verify
                        await page.focus(selector);
                        await page.evaluate(el => el.value = '', element);
                        
                        // Add delay between characters for better registration
                        await page.type(selector, value, { delay: 100 });
                        
                        // Trigger blur event to validate
                        await page.evaluate(el => {
                            el.blur();
                            // Trigger change and input events to ensure registration
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }, element);
                        
                        // Wait for validation to complete
                        await waitForStabilization(page, log, 1000);
                        
                        // Verify value was set and registered
                        const actualValue = await page.evaluate(el => el.value, element);
                        if (actualValue === value || actualValue.includes(value)) {
                            log.info(`✅ ${fieldName} successfully filled`);
                            return true;
                        } else {
                            log.warning(`⚠️ ${fieldName} value not registered. Expected: ${value}, Got: ${actualValue}`);
                            
                            // Try again with different approach
                            await page.focus(selector);
                            await page.keyboard.down('Control');
                            await page.keyboard.press('a');
                            await page.keyboard.up('Control');
                            await page.keyboard.type(value);
                            await waitForStabilization(page, log, 500);
                            
                            const retryValue = await page.evaluate(el => el.value, element);
                            if (retryValue === value) {
                                log.info(`✅ ${fieldName} successfully filled on retry`);
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            log.warning(`Error filling ${fieldName} with selector ${selector}: ${error.message}`);
            continue;
        }
    }
    
    log.error(`❌ Could not fill ${fieldName}`);
    return false;
}

async function fillSelectWithValidation(page, log, fieldConfig) {
    const { selectors, value, fieldName } = fieldConfig;
    
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                await page.select(selector, value);
                await waitForStabilization(page, log, 500);
                
                const selectedValue = await page.evaluate(el => el.value, element);
                if (selectedValue === value) {
                    log.info(`✅ ${fieldName} successfully selected: ${value}`);
                    return true;
                }
            }
        } catch (error) {
            continue;
        }
    }
    
    log.error(`❌ Could not select ${fieldName}`);
    return false;
}

// CRITICAL: Robust wait for form stabilization
async function waitForStabilization(page, log, minWait = 1000) {
    // Always wait minimum time
    await new Promise(resolve => setTimeout(resolve, minWait));
    
    // Additional wait for any loading indicators to disappear
    try {
        await page.waitForFunction(() => {
            // Check for loading indicators
            const loaders = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="wait"]');
            return loaders.length === 0 || Array.from(loaders).every(loader => 
                loader.offsetWidth === 0 || loader.offsetHeight === 0
            );
        }, { timeout: 5000 });
    } catch (error) {
        // If no loaders found or timeout, continue
    }
}

async function captureQuoteData(page, log) {
    log.info('💰 Capturing comprehensive quote data...');
    
    try {
        // Wait for results to load completely
        await waitForStabilization(page, log, 3000);
        
        return await page.evaluate(() => {
            const quotes = [];
            const pricing = {};
            const tariffs = [];
            const coverage = {};
            
            // Enhanced price detection with multiple patterns
            const pricePatterns = [
                /\d+[,.]?\d*\s*€/g,
                /€\s*\d+[,.]?\d*/g,
                /\d+[,.]?\d*\s*Euro/g,
                /\d+[,.]?\d*\s*EUR/g
            ];
            
            // Look for comprehensive price elements
            const priceSelectors = [
                '[class*="price"]', '[class*="kosten"]', '[class*="beitrag"]',
                '[class*="tarif"]', '[class*="quote"]', '[class*="angebot"]',
                '[class*="summe"]', '[class*="gesamt"]', '[class*="monat"]',
                '[data-price]', '[data-cost]', '[data-tariff]'
            ];
            
            priceSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el, index) => {
                    const text = el.textContent?.trim();
                    if (text) {
                        // Check for price patterns
                        pricePatterns.forEach(pattern => {
                            const matches = text.match(pattern);
                            if (matches) {
                                matches.forEach(match => {
                                    const key = `${selector.replace(/[\[\]]/g, '')}_${index}`;
                                    pricing[key] = {
                                        text: text,
                                        price: match,
                                        element: selector,
                                        fullContext: el.closest('[class*="card"], [class*="box"], [class*="container"]')?.textContent?.trim()?.substring(0, 200)
                                    };
                                });
                            }
                        });
                    }
                });
            });
            
            // Look for tariff/quote cards with more detail
            const cardSelectors = [
                '[class*="quote"]', '[class*="tarif"]', '[class*="angebot"]',
                '[class*="card"]', '[class*="product"]', '[class*="package"]',
                '[class*="option"]', '[class*="versicherung"]'
            ];
            
            cardSelectors.forEach(selector => {
                const cards = document.querySelectorAll(selector);
                cards.forEach((card, index) => {
                    const title = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]')?.textContent?.trim();
                    const priceElement = card.querySelector('[class*="price"], [class*="kosten"], [class*="beitrag"]');
                    const price = priceElement?.textContent?.trim();
                    const description = card.querySelector('[class*="description"], [class*="detail"], p')?.textContent?.trim();
                    
                    if (title || price) {
                        tariffs.push({
                            index: index,
                            title: title || '',
                            price: price || '',
                            description: description || '',
                            fullText: card.textContent?.trim()?.substring(0, 300),
                            selector: selector
                        });
                    }
                });
            });
            
            // Look for coverage information
            const coverageSelectors = [
                '[class*="coverage"]', '[class*="deckung"]', '[class*="leistung"]',
                '[class*="schutz"]', '[class*="benefit"]', '[class*="feature"]'
            ];
            
            coverageSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el, index) => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 10) {
                        coverage[`${selector}_${index}`] = text.substring(0, 150);
                    }
                });
            });
            
            // Look for specific Allianz result indicators
            const resultIndicators = [
                document.querySelector('[class*="result"]'),
                document.querySelector('[class*="quote"]'),
                document.querySelector('[class*="berechnung"]'),
                document.querySelector('[class*="angebot"]'),
                document.querySelector('[id*="result"]'),
                document.querySelector('[id*="quote"]')
            ].filter(Boolean);
            
            const hasResults = resultIndicators.length > 0 || 
                              Object.keys(pricing).length > 0 || 
                              tariffs.length > 0 ||
                              document.body.textContent.includes('€') ||
                              document.body.textContent.includes('Euro') ||
                              document.body.textContent.includes('Tarif') ||
                              document.body.textContent.includes('Angebot');
            
            // Enhanced result summary
            const resultSummary = {
                hasResultsPage: hasResults,
                priceElementsFound: Object.keys(pricing).length,
                tariffCardsFound: tariffs.length,
                coverageElementsFound: Object.keys(coverage).length,
                pageContainsEuro: document.body.textContent.includes('€'),
                pageContainsTarif: document.body.textContent.includes('Tarif'),
                urlIndicatesResults: window.location.href.includes('result') || window.location.href.includes('quote'),
                currentUrl: window.location.href
            };
            
            // Extract visible text snippets that might contain pricing
            const textContent = document.body.textContent;
            const euroMatches = textContent.match(/[^\n]*€[^\n]*/g) || [];
            const euroSnippets = euroMatches.slice(0, 10).map(match => match.trim().substring(0, 100));
            
            return {
                captured: hasResults,
                resultSummary: resultSummary,
                quotes: tariffs,
                pricing: pricing,
                coverage: coverage,
                euroSnippets: euroSnippets,
                timestamp: new Date().toISOString(),
                debug: {
                    pageTitle: document.title,
                    currentUrl: window.location.href,
                    bodyTextLength: textContent.length,
                    hasVisibleContent: document.body.offsetWidth > 0 && document.body.offsetHeight > 0
                }
            };
        });
    } catch (error) {
        log.error(`Error capturing enhanced quote data: ${error.message}`);
        return { 
            captured: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function takeStepScreenshot(page, stepName, screenshots) {
    const filename = `step-${stepName}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push(filename);
} 