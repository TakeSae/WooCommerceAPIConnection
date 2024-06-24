const axios = require("axios");

// WooCommerce API credentials
const WooCommerceAPI = "***";
const key = "***";
const secret = "***";

// AutoGestor API GET
const autoGestorAPI = "***";

// transmission mapping from AutoGestor to WooCommerce tags IDs
const transmissionMapping = {
  "automatico": 55,
  "manual": 56,
  "cvt": 87,
  "pdk": 88,
};

// brand mapping from AutoGestor to WooCommerce category IDs
const brandMapping = {
  "audi": 97,
  "bmw": 98,
  "byd": 100,
  "chery": 101,
  "chevrolet": 102,
  "citroen": 103,
  "fiat": 104,
  "ford": 105,
  "harley davidson": 106,
  "honda": 107,
  "hyundai": 108,
  "jaguar": 109,
  "jeep": 110,
  "kia": 111,
  "land rover": 112,
  "mercedes_benz": 113,
  "mitsubishi": 114,
  "nissan": 115,
  "porsche": 116,
  "ram": 117,
  "renault": 118,
  "suzuki": 119,
  "toyota": 120,
  "volkswagen": 99,
  "volvo": 121,
};

// color mapping from AutoGestor to WooCommerce tags IDs
const colorMapping = {
  "azul": 71,
  "bege": 72,
  "branco": 73,
  "cinza": 74,
  "dourado": 75,
  "laranja": 76,
  "prata": 77,
  "preto": 78,
  "rosa": 79,
  "verde": 80,
  "vermelho": 81,
};

// fuel mapping from AutoGestor to WooCommerce tags IDs
const fuelMapping = {
  "diesel": 82,
  "eletrico": 83,
  "flex": 84,
  "gasolina": 85,
  "hibrido": 86,
};

// door mapping from AutoGestor to WooCommerce tags IDs
const doorMapping = {
  2: 122,
  4: 90,
};

// Utility function to make Axios requests with retry logic
async function axiosRequestWithRetry(config, maxRetries = 15) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
        // Retry on connection aborted or 5xx errors
        retries++;
        //console.error(`Request failed (Attempt ${retries} of ${maxRetries}). Retrying...`, error);
        console.error(`Request failed (Attempt ${retries} of ${maxRetries}). Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
      } else {
        throw error; // Do not retry on other errors
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts.`);
}

// Function to fetch data from AutoGestor with duplicate check
async function fetchDataFromAutoGestorWithRetry(maxRetries = 50) {
  const config = {
    method: 'get',
    url: autoGestorAPI,
  };
  const response = await axiosRequestWithRetry(config, maxRetries);
  const vehicles = response.data.veiculos || [];

  // Check for duplicates based on SKU (assuming codigo is SKU)
  const uniqueVehicles = [];
  const seenSkus = new Set();
  const skusToRemove = []; // Array to store SKUs to be removed

  // Fetch all products currently in WooCommerce
  const allProductsInWooCommerce = await fetchAllProductsFromWooCommerce();
  const skusFromWooCommerce = allProductsInWooCommerce.map(product => product.sku);

  vehicles.forEach(vehicle => {
    const sku = vehicle.codigo.toString();
    if (!seenSkus.has(sku)) {
      uniqueVehicles.push(vehicle);
      seenSkus.add(sku);
    } else {
      console.warn(`Duplicate vehicle found with SKU ${sku}.`);
      skusToRemove.push(sku); // Add duplicate SKUs to removal list
    }
  });

  // Remove duplicated products from WooCommerce
  if (skusToRemove.length > 0) {
    await removeProductsFromWooCommerce(skusToRemove);
  }

  return uniqueVehicles;
}

// Function to check if a product already exists in WooCommerce by SKU
async function productExistsInWooCommerce(sku) {
  const config = {
    method: 'get',
    url: `${WooCommerceAPI}?sku=${encodeURIComponent(sku)}`,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
      "Content-Type": "application/json",
    },
  };
  const response = await axiosRequestWithRetry(config);
  return response.data.length > 0; // True if product exists, false otherwise
}

// Function to create products in WooCommerce with batch processing
async function createProductsInWooCommerce(vehicles) {
  const batches = [];
  const batchSize = 20;

  const uniqueVehicles = []; // Array to store non-duplicate vehicles

  for (const vehicle of vehicles) {
    const sku = vehicle.codigo.toString();
    const exists = await productExistsInWooCommerce(sku);

    if (!exists) {
      uniqueVehicles.push(vehicle);
    } else {
      console.warn(`Skipping creation of product with SKU ${sku} due to duplication.`);
      // Optionally handle or log the duplicate
    }
  }

  for (let i = 0; i < vehicles.length; i += batchSize) {
    const batch = vehicles.slice(i, i + batchSize);
    const data = batch.map(vehicle => {
      const { codigo, modelo, marca, ano_modelo, descricao, preco, fotos, categoria, cambio, combustivel, cor, portas, acessorios } = vehicle;
      const sku = codigo.toString();
      const categoryID = brandMapping[marca.toLowerCase()] || "";

      const tags = [];
      if (transmissionMapping[cambio.toLowerCase()]) {
        tags.push({ id: transmissionMapping[cambio.toLowerCase()] });
      }
      if (colorMapping[cor.toLowerCase()]) {
        tags.push({ id: colorMapping[cor.toLowerCase()] });
      }
      if (fuelMapping[combustivel.toLowerCase()]) {
        tags.push({ id: fuelMapping[combustivel.toLowerCase()] });
      }
      if (doorMapping[portas]) {
        tags.push({ id: doorMapping[portas] });
      }

      const accessoriesList = acessorios.map(accessory => `- ${accessory}`).join('\n');

      return {
        name: `${marca} ${modelo} ${ano_modelo}`,
        type: "simple",
        catalog_visibility: "visible",
        description: `${descricao || ""}\n\n<b>Lista de Acessórios:</b>\n${accessoriesList}`,
        short_description: "",
        sku: sku,
        regular_price: convertCurrency(preco.venda).toFixed(2), // Convert price to WooCommerce format
        virtual: false,
        images: fotos.map((src) => ({ src })),
        categories: [{ id: categoryID }],
        tags: tags,
      };
    });

    batches.push(data);
  }

  for (const batch of batches) {
    const config = {
      method: 'post',
      url: `${WooCommerceAPI}/batch`,
      headers: {
        Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
        "Content-Type": "application/json",
      },
      data: {
        create: batch,
      },
    };
    const response = await axiosRequestWithRetry(config);
    //console.log("Batch created successfully:", response.data);
    console.log("Batch created successfully.");
  }
}

// Function to update products in WooCommerce with batch processing
async function updateProductsInWooCommerce(updates) {
  const batchSize = 20;
  const batches = [];

  const uniqueUpdates = []; // Array to store non-duplicate updates

  for (const { vehicle, wooCommerceData } of updates) {
    const sku = vehicle.codigo.toString();
    const exists = await productExistsInWooCommerce(sku);

    if (exists) {
      uniqueUpdates.push({ vehicle, wooCommerceData });
    } else {
      console.warn(`Skipping update of product with SKU ${sku} as it does not exist in WooCommerce.`);
      // Optionally handle or log the non-existence
    }
  }

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const data = batch.map(({ vehicle, wooCommerceData }) => {
      const { id } = wooCommerceData;
      const { codigo, modelo, marca, ano_modelo, descricao, preco, fotos, cambio, combustivel, cor, portas, acessorios } = vehicle;
      const categoryID = brandMapping[marca.toLowerCase()] || "";

      const tags = [];
      if (transmissionMapping[cambio.toLowerCase()]) {
        tags.push({ id: transmissionMapping[cambio.toLowerCase()] });
      }
      if (colorMapping[cor.toLowerCase()]) {
        tags.push({ id: colorMapping[cor.toLowerCase()] });
      }
      if (fuelMapping[combustivel.toLowerCase()]) {
        tags.push({ id: fuelMapping[combustivel.toLowerCase()] });
      }
      if (doorMapping[portas]) {
        tags.push({ id: doorMapping[portas] });
      }

      const accessoriesList = acessorios.map(accessory => `- ${accessory}`).join('\n');

      return {
        id,
        name: `${marca} ${modelo} ${ano_modelo}`,
        description: `${descricao || ""}\n\n<b>Lista de Acessórios:</b>\n${accessoriesList}`,
        regular_price: convertCurrency(preco.venda).toFixed(2),
        images: fotos.map((src) => ({ src })),
        categories: [{ id: categoryID }],
        tags: tags,
      };
    });

    batches.push(data);
  }

  // Execute batch updates in parallel
  await Promise.all(batches.map(async (batch) => {
    const config = {
      method: 'post',
      url: `${WooCommerceAPI}/batch`,
      headers: {
        Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
        "Content-Type": "application/json",
      },
      data: {
        update: batch,
      },
    };

    try {
      const response = await axiosRequestWithRetry(config);
      console.log("Batch updated successfully:", response.data);
      // Optionally log more detailed information
      batch.forEach(product => {
        console.log(`Updated product ID ${product.id}`);
      });
    } catch (error) {
      console.error("Error updating batch:", error);
      // Optionally handle error cases or log specific errors
    }
  }));

  console.log("All batches updated successfully.");
}

// Function to fetch product from WooCommerce by SKU
async function fetchProductFromWooCommerce(sku) {
  const config = {
    method: 'get',
    url: `${WooCommerceAPI}?sku=${encodeURIComponent(sku)}`,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
      "Content-Type": "application/json",
    },
  };
  const response = await axiosRequestWithRetry(config);
  return response.data[0] || null; // Return the first matching product or null
}

// Function to verify if AutoGestor data matches WooCommerce data
function verifyDataMatch(autoGestorData, wooCommerceData) {
  if (!wooCommerceData) {
    console.log(`WooCommerce data is null or undefined for SKU ${autoGestorData.codigo}`);
    return false;
  }

  const { modelo, marca, ano_modelo, descricao, preco, fotos, categoria, cambio, combustivel, cor, portas, acessorios } = autoGestorData;

  const categoryID = brandMapping[marca.toLowerCase()] || "";
  const tags = [
    transmissionMapping[cambio.toLowerCase()],
    colorMapping[cor.toLowerCase()],
    fuelMapping[combustivel.toLowerCase()],
    doorMapping[portas]
  ].filter(Boolean); // Filter out undefined values

  const wooCategories = wooCommerceData.categories.map(cat => cat.id);
  const wooTags = wooCommerceData.tags.map(tag => tag.id);

  const wooCommerceImages = wooCommerceData.images.map(img => img.src);
  const accessoriesList = acessorios.map(accessory => `- ${accessory}`).join("<br />", '\n');
  const expectedDescription = `${descricao || ""}<p><b>Lista de Acessórios:</b><br />\n${accessoriesList}</p>`

  // Compare all relevant fields
  const isMatch =
    wooCommerceData.name === `${marca} ${modelo} ${ano_modelo}` &&
    wooCommerceData.short_description === "" &&
    //wooCommerceData.description === expectedDescription && // this is not working due to the formating coming from woocommerce, something that I couldn't replicate.
    wooCommerceData.sku === autoGestorData.codigo.toString() &&
    parseFloat(wooCommerceData.regular_price) === convertCurrency(preco.venda) && // Convert prices to float for comparison
    //arraysEqual(wooCommerceImages, fotos) && // Of course this will be different, the img change URL when they are uploaded to the fucking wooCommerce........something to figure out later....
    wooCategories.includes(categoryID) &&
    tags.every(tag => wooTags.includes(tag));

  if (!isMatch) {
    console.log("wooCategories.includes(categoryID): ", wooCategories.includes(categoryID));
    console.log("tags.every(tag => wooTags.includes(tag)): ", tags.every(tag => wooTags.includes(tag)));
    console.log(`Data doesn't match for SKU [ ${autoGestorData.codigo} ]...`);
    console.log("----- \n");
  } else {
    console.log(`Data matches for SKU [ ${autoGestorData.codigo} ]!`);
    console.log("----- \n");
  }

  return isMatch;
}

// Helper function to compare arrays
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

// Function to convert Brazilian currency format to decimal format
function convertCurrency(currencyString) {
  const cleanedString = currencyString.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedString);
}

// Function to check for changes
async function checkForChanges() {
  console.log("\n\n------------------------------------------------------");
  console.log("START OF VERIFICATION PROCESS");
  console.log("------------------------------------------------------\n\n");
  try {
    const vehicles = await fetchDataFromAutoGestorWithRetry();
    const updates = [];

    for (const vehicle of vehicles) {
      const sku = vehicle.codigo.toString();
      const wooProduct = await fetchProductFromWooCommerce(sku);

      if (!verifyDataMatch(vehicle, wooProduct)) {
        updates.push({ vehicle, wooCommerceData: wooProduct });
      }
    }

    if (updates.length > 0) {
      await updateProductsInWooCommerce(updates); // Batch update the WooCommerce products if there's a mismatch
    } else {
      console.log("No updates needed.");
    }
  } catch (error) {
    console.error("Verification process error:", error);
  }
  console.log("\n\n------------------------------------------------------");
  console.log("END OF VERIFICATION PROCESS");
  console.log("------------------------------------------------------");
}

// Function to fetch all products from woocommerce
async function fetchAllProductsFromWooCommerce(page = 1, allProducts = []) {
  const config = {
    method: 'get',
    url: `${WooCommerceAPI}?per_page=100&page=${page}`,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
      "Content-Type": "application/json",
    },
  };

  const response = await axiosRequestWithRetry(config);
  const products = response.data;

  if (products.length > 0) {
    return fetchAllProductsFromWooCommerce(page + 1, allProducts.concat(products));
  } else {
    return allProducts;
  }
}

//Function to indentify duplicates
function identifyDuplicates(products) {
  const skuCounts = {};
  const duplicates = [];

  products.forEach(product => {
    const { sku } = product;
    if (skuCounts[sku]) {
      skuCounts[sku].count += 1;
      skuCounts[sku].ids.push(product.id);
    } else {
      skuCounts[sku] = { count: 1, ids: [product.id] };
    }
  });

  for (const sku in skuCounts) {
    if (skuCounts[sku].count > 1) {
      // Keep one product and mark the rest as duplicates
      const idsToRemove = skuCounts[sku].ids.slice(1);
      duplicates.push(...idsToRemove);
    }
  }

  return duplicates;
}

// Function to remove products from WooCommerce by SKU
async function deleteProductsFromWooCommerce(productIds) {
  for (const id of productIds) {
    const config = {
      method: 'delete',
      url: `${WooCommerceAPI}/${id}?force=true`,
      headers: {
        Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await axiosRequestWithRetry(config);
      //console.log(`Deleted product with ID ${id}:`, response.data);
      console.log(`Deleted product with ID ${id}.`);
    } catch (error) {
      console.error(`Error deleting product with ID ${id}:`, error);
    }
  }
}


// Main function to orchestrate the process
async function main() {
  console.log("\n\n------------------------------------------------------");
  console.log("START OF PROCESSING");
  console.log("------------------------------------------------------\n\n");
  try {
    const vehicles = await fetchDataFromAutoGestorWithRetry();
    const productsToCreate = [];

    for (const vehicle of vehicles) {
      const sku = vehicle.codigo.toString();
      const exists = await productExistsInWooCommerce(sku);

      if (!exists) {
        productsToCreate.push(vehicle);
      } else {
        console.log(`Product with SKU [ ${sku} ] already exists in WooCommerce. Skipping creation.`);
      }
    }

    if (productsToCreate.length > 0) {
      await createProductsInWooCommerce(productsToCreate);
    }

    // Fetch all products from WooCommerce
    const allProducts = await fetchAllProductsFromWooCommerce();

    // Identify duplicates
    const duplicates = identifyDuplicates(allProducts);

    // Remove duplicates
    if (duplicates.length > 0) {
      await deleteProductsFromWooCommerce(duplicates);
    } else {
      console.log("No duplicates found.");
    }

    // Call checkForChanges to verify and log any data mismatches
    await checkForChanges();

  } catch (error) {
    console.error("Main process error:", error);
  }
  console.log("\n\n------------------------------------------------------");
  console.log("END OF PROCESSING");
  console.log("\n----- \n All products created in WooCommerce. \n----- \n");
  console.log("------------------------------------------------------\n\n\n");
}

// Run the main function
main();
