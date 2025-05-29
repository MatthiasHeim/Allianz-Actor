# Allianz Auto Insurance Quote Actor

This actor automates the process of filling out and submitting auto insurance quote forms on the Allianz website. It can analyze form structures, input customer data, and attempt to retrieve insurance quotes.

## Features

- **Form Analysis**: Automatically detects and analyzes form fields on the Allianz quote page
- **Data Input**: Fills out personal, vehicle, and insurance information
- **Screenshot Capture**: Takes screenshots before and after form submission for debugging
- **Flexible Configuration**: Supports custom data input through actor configuration
- **Error Handling**: Robust error handling with detailed logging

## Input Configuration

The actor accepts the following input parameters:

### Start URLs
- **Default**: `https://www.allianz.de/auto/kfz-versicherung/rechner/`
- You can specify different URLs if needed

### Personal Information (`personalData`)
```json
{
  "salutation": "Herr",           // "Herr" or "Frau"
  "firstName": "Max",
  "lastName": "Mustermann",
  "birthDate": "01.01.1985",      // Format: DD.MM.YYYY
  "street": "Musterstraße 123",
  "zipCode": "10115",
  "city": "Berlin",
  "email": "max.mustermann@example.com",
  "phone": "030-12345678"
}
```

### Vehicle Information (`vehicleData`)
```json
{
  "vehicleMake": "Volkswagen",
  "vehicleModel": "Golf",
  "firstRegistration": "01.01.2020",  // Format: DD.MM.YYYY
  "licensePlate": "B-MW 1234",
  "vehicleValue": "25000",             // EUR
  "annualMileage": "15000"             // km per year
}
```

### Insurance Information (`insuranceData`)
```json
{
  "insuranceType": "Vollkasko",        // "Vollkasko", "Teilkasko", or "Haftpflicht"
  "previousInsurer": "Keine Versicherung",
  "claimFreeYears": "5",
  "desiredStartDate": "01.01.2024"     // Format: DD.MM.YYYY
}
```

## Example Input

```json
{
  "startUrls": [
    {
      "url": "https://www.allianz.de/auto/kfz-versicherung/rechner/"
    }
  ],
  "personalData": {
    "salutation": "Frau",
    "firstName": "Anna",
    "lastName": "Schmidt",
    "birthDate": "15.03.1990",
    "street": "Hauptstraße 456",
    "zipCode": "80331",
    "city": "München",
    "email": "anna.schmidt@example.com",
    "phone": "089-98765432"
  },
  "vehicleData": {
    "vehicleMake": "BMW",
    "vehicleModel": "3er",
    "firstRegistration": "01.06.2021",
    "licensePlate": "M-AS 5678",
    "vehicleValue": "35000",
    "annualMileage": "12000"
  },
  "insuranceData": {
    "insuranceType": "Vollkasko",
    "previousInsurer": "HUK-COBURG",
    "claimFreeYears": "3",
    "desiredStartDate": "01.02.2024"
  }
}
```

## Output

The actor saves the following data to the dataset:

```json
{
  "url": "https://www.allianz.de/auto/kfz-versicherung/rechner/",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "formStructure": {
    "forms": [...],      // Detected form elements
    "inputs": [...]      // Detected input fields
  },
  "quoteResult": {
    "filledFields": [...],    // Successfully filled fields
    "submitResult": {         // Form submission result
      "submitted": true,
      "button": "button[type='submit']",
      "hasResults": true,
      "hasErrors": false
    },
    "formData": {...}         // Data used to fill the form
  },
  "inputData": {...}          // Original input configuration
}
```

## Running the Actor

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Run with default data:
```bash
npm start
```

3. Run with custom input:
```bash
npm start -- --input='{"personalData":{"firstName":"Anna","lastName":"Schmidt"}}'
```

### Production

Deploy to Apify platform and configure input through the web interface.

## Technical Details

### Form Field Detection

The actor uses intelligent selectors to detect German insurance form fields:

- **Personal fields**: `anrede`, `vorname`, `nachname`, `geburt`, `strasse`, `plz`, `ort`, `email`, `telefon`
- **Vehicle fields**: `marke`, `modell`, `erstzulassung`, `kennzeichen`, `wert`, `kilometer`
- **Insurance fields**: `schadenfreiheit`, `beginn`

### Browser Configuration

- **Headless mode**: Disabled for debugging (set to `true` for production)
- **Screenshots**: Automatically captured for form analysis
- **Proxy support**: Uses Apify proxy configuration
- **Error handling**: Comprehensive error logging and recovery

### Limitations

- Currently optimized for the Allianz website structure
- Requires valid German address and vehicle data
- Form submission success depends on website availability and structure
- Some dynamic form elements may require manual adjustment

## Troubleshooting

### Common Issues

1. **Form fields not found**: Check if the website structure has changed
2. **Submission failed**: Verify that all required fields are properly filled
3. **Timeout errors**: Increase wait times for slow-loading pages
4. **Proxy issues**: Check proxy configuration and availability

### Debug Mode

Set `headless: false` in the launch options to see the browser in action and debug form filling issues.

### Screenshots

The actor automatically saves screenshots:
- `allianz-form.png`: Initial form state
- `before-submit.png`: Form state before submission
- `after-submit.png`: Results page after submission

## Contributing

To extend this actor for other insurance providers:

1. Create a new router file (e.g., `other-insurer-routes.js`)
2. Implement provider-specific form field mappings
3. Update the main.js file to use the appropriate router
4. Test with the new provider's website

## License

This project is licensed under the ISC License.
