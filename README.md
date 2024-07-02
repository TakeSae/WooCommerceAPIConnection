# AutoGestor-WooCommerce Integration

This repository contains code to synchronize vehicle data between the AutoGestor API and a WooCommerce store. The script fetches data from AutoGestor, checks for duplicates and orphaned products in WooCommerce, creates or updates products as necessary, and ensures data consistency between the two systems.

## Prerequisites

- Node.js
- npm
- WooCommerce store with REST API enabled
- AutoGestor API access

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/autogestor-woocommerce-integration.git
   cd autogestor-woocommerce-integration
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   WOO_API_URL=<Your WooCommerce API URL>
   KEY=<Your WooCommerce API Key>
   SECRET=<Your WooCommerce API Secret>
   AG_API_URL=<Your AutoGestor API URL>
   ```

## Usage

To run the synchronization script, execute the following command:
```bash
node index.js
```

## Code Overview

### Configuration

- **WooCommerce API credentials:** The WooCommerce API URL, key, and secret are stored in environment variables.
- **AutoGestor API URL:** The URL for the AutoGestor API is also stored in an environment variable.

### Mappings

Mappings are provided for:
- Transmission types
- Brands
- Colors
- Fuel types
- Door counts

These mappings are used to translate AutoGestor data into WooCommerce category and tag IDs.

### Functions

- **axiosRequestWithRetry:** Utility function to make Axios requests with retry logic.
- **fetchDataFromAutoGestorWithRetry:** Fetches data from AutoGestor and checks for duplicates.
- **productExistsInWooCommerce:** Checks if a product exists in WooCommerce by SKU.
- **createProductsInWooCommerce:** Creates new products in WooCommerce using batch processing.
- **updateProductsInWooCommerce:** Updates existing products in WooCommerce using batch processing.
- **fetchProductFromWooCommerce:** Fetches a product from WooCommerce by SKU.
- **verifyDataMatch:** Verifies if AutoGestor data matches WooCommerce data.
- **convertCurrency:** Converts Brazilian currency format to decimal format.
- **checkForChanges:** Checks for changes between AutoGestor and WooCommerce data.
- **fetchAllProductsFromWooCommerce:** Fetches all products from WooCommerce.
- **identifyDuplicates:** Identifies duplicate products in WooCommerce.
- **deleteProductsFromWooCommerce:** Deletes products from WooCommerce by IDs.
- **removeOrphanedProducts:** Removes orphaned products from WooCommerce.
- **main:** Main function that orchestrates the entire process.

### Process

1. Fetch data from AutoGestor.
2. Check for duplicates and orphaned products in WooCommerce.
3. Create new products in WooCommerce.
4. Identify and remove duplicate products in WooCommerce.
5. Remove orphaned products from WooCommerce.
6. Verify data consistency between AutoGestor and WooCommerce.
7. Log the results.

## Logging

The script logs various messages to the console, including information about:
- Duplicates found
- Products created or updated
- Products deleted
- Any errors encountered

## Contributing

Feel free to submit issues or pull requests if you have suggestions for improvements or find any bugs.

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Axios](https://github.com/axios/axios) for handling HTTP requests.
- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/) for providing the API endpoints.
- [AutoGestor API](https://autogestor.com.br/api-docs) for vehicle data.

---

Feel free to update the repository URL, API URLs, and other placeholder values to suit your actual use case.
