const axios = require("axios");

// WooCommerce API credentials
const WooCommerceAPI = "****";
const key = "****";
const secret = "****";

// AutoGestor API GET
const autoGestorAPI = "****";

// Category mapping from AutoGestor to WooCommerce category IDs
const categoryMapping = {
  "carros": 290,
  "utilitários": 292,
  "caminhao": 293,
  "camionete": 294,
  "moto": 291,
  // Add more mappings as needed
};

// transmission mapping from AutoGestor to WooCommerce tags IDs
const transmissionMapping = {
  "automatico": 258,
  "manual": 259,
  "cvt": 286,
  "pdk": 287,
};

// brand mapping from AutoGestor to WooCommerce tags IDs
const brandMapping = {
  "volkswagen": 26,
  "jaguar": 27,
  "audi": 15,
  "volvo": 24,
  "porsche": 28,
  "ford": 199,
  "renault": 32,
  "byd": 250,
  "citroen": 256,
  "jeep": 23,
  "hyundai": 29,
  "chevrolet": 30,
  "bmw": 21,
  "fiat": 198,
  "toyota": 200,
  "suzuki": 257,
  "ram": 194,
  "nissan": 197,
  "mitsubishi": 253,
  "mercedes-benz": 25,
  "land rover": 255,
  "kia": 254,
  "honda": 33,
  "harley davidson": 31,
  "chery": 22,
};

// color mapping from AutoGestor to WooCommerce tags IDs
const colorMapping = {
  "azul": 270,
  "bege": 271,
  "branco": 272,
  "cinza": 273,
  "dourado": 274,
  "laranja": 275,
  "prata": 276,
  "preto": 277,
  "rosa": 278,
  "verde": 279,
  "vermelho": 280,
};

// fuel mapping from AutoGestor to WooCommerce tags IDs
const fuelMapping = {
  "diesel": 280,
  "eletrico": 282, 
  "flex": 283, 
  "gasolina": 284, 
  "hibrido": 285, 
};

// door mapping from AutoGestor to WooCommerce tags IDs
const doorMapping = {
  2: 288,
  4: 289,
};

// Function to fetch data from autoGestor API with retry
async function fetchDataFromAutoGestorWithRetry(maxRetries = 50) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await axios.get(autoGestorAPI);
      return response.data.veiculos || []; // Ensure to handle empty response or missing data
    } catch (error) {
      console.error(`Error fetching data from autoGestor API (Attempt ${retries + 1} of ${maxRetries}):`, error);
      retries++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
    }
  }
  throw new Error(`Failed to fetch data from autoGestor API after ${maxRetries} attempts.`);
}

// Function to check if a product already exists in WooCommerce by SKU
async function productExistsInWooCommerce(sku) {
  try {
    const response = await axios.get(
      `${WooCommerceAPI}?sku=${encodeURIComponent(sku)}`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.length > 0; // True if product exists, false otherwise
  } catch (error) {
    //console.error("Error checking product in WooCommerce:", error);
    throw error;
  }
}

// Function to create a product in WooCommerce with retry
async function createProductInWooCommerce(vehicle, maxRetries = 50) {
  let retries = 0;
  while (retries < maxRetries) {
    if (!vehicle) {
      console.log("No more vehicles to create. Stopping.");
      return null;
    }
    try {
      const { codigo, modelo, marca, ano_modelo, descricao, preco, fotos, categoria, cambio, combustivel, cor, portas, acessorios } = vehicle;
      const sku = codigo.toString();
      const categoryID = brandMapping[marca.toLowerCase()] || "";

      const tags = [];
      if (transmissionMapping[cambio.toLowerCase()]) {
        tags.push({ id: transmissionMapping[cambio.toLowerCase()] });
      }
      /* if (brandMapping[marca.toLowerCase()]) {
        tags.push({ id: brandMapping[marca.toLowerCase()] });
      } */
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

      const response = await axios.post(WooCommerceAPI, {
        name: `${modelo} ${marca} ${ano_modelo}`,
        type: "simple",
        catalog_visibility: "visible",
        description: `${descricao || ""}\n\n<b>Lista de Acessórios:</b>\n${accessoriesList}`,
        short_description: "",
        sku: sku,
        regular_price: convertCurrency(preco.venda).toFixed(2), // Convert price to WooCommerce format
        virtual: false,
        images: fotos.map((src) => ({ src })),
        categories: [{ id: categoryID }],
        tags: tags, // Ensure tags are included in the payload
      }, {
        headers: {
          Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          "Content-Type": "application/json",
        },
      });

      //console.log("Product created:", response.data);
      console.log(`Product with SKU ${sku} created successfully.`);
      return response.data;
    } catch (error) {
      /* console.error(
        `Error creating product in WooCommerce (Attempt ${retries + 1} of ${maxRetries}):`,
        error.response?.data || error.message
      ); */
      console.error(
        `Error creating product in WooCommerce (Attempt ${retries + 1} of ${maxRetries}), retrying.`
      );
      retries++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
    }
  }
  throw new Error(`Failed to create product in WooCommerce after ${maxRetries} attempts.`);
}

// Function to update a product in WooCommerce with retry
async function updateProductInWooCommerce(vehicle, wooCommerceData, maxRetries = 50) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const { id } = wooCommerceData;
      const { codigo, modelo, marca, ano_modelo, descricao, preco, fotos, categoria, cambio, combustivel, cor, portas, acessorios } = vehicle;
      const categoryID = brandMapping[marca.toLowerCase()] || "";

      const tags = [];
      if (transmissionMapping[cambio.toLowerCase()]) {
        tags.push({ id: transmissionMapping[cambio.toLowerCase()] });
      }
      /* if (brandMapping[marca.toLowerCase()]) {
        tags.push({ id: brandMapping[marca.toLowerCase()] });
      } */
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

      const response = await axios.put(`${WooCommerceAPI}/${id}`, {
        name: `${modelo} ${marca} ${ano_modelo}`,
        description: `${descricao || ""}\n\n<b>Lista de Acessórios:</b>\n${accessoriesList}`,
        regular_price: convertCurrency(preco.venda).toFixed(2), // Convert price to WooCommerce format
        images: fotos.map((src) => ({ src })),
        categories: [{ id: categoryID }],
        tags: tags, // Ensure tags are included in the payload
      }, {
        headers: {
          Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          "Content-Type": "application/json",
        },
      });

      console.log(`Product with SKU [ ${codigo} ] updated successfully.`);
      return response.data;
    } catch (error) {
      console.error(error);
      console.error(
        `Error updating product in WooCommerce (Attempt ${retries + 1} of ${maxRetries}), retrying.`
      );
      retries++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
    }
  }
  throw new Error(`Failed to update product in WooCommerce after ${maxRetries} attempts.`);
}

// Function to fetch product details from WooCommerce by SKU
async function fetchProductFromWooCommerce(sku) {
  try {
    const response = await axios.get(
      `${WooCommerceAPI}?sku=${encodeURIComponent(sku)}`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          "Content-Type": "application/json",
        },
      }
    );

    return response.data[0] || null; // Return the first matching product or null
  } catch (error) {
    console.error("Error fetching product from WooCommerce:", error);
    throw error;
  }
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
    //brandMapping[marca.toLowerCase()],
    colorMapping[cor.toLowerCase()],
    fuelMapping[combustivel.toLowerCase()],
    doorMapping[portas]
  ].filter(Boolean); // Filter out undefined values

  const wooCategories = wooCommerceData.categories.map(cat => cat.id);
  const wooTags = wooCommerceData.tags.map(tag => tag.id);

  const wooCommerceImages = wooCommerceData.images.map(img => img.src);
  const accessoriesList = acessorios.map(accessory => `- ${accessory}`).join('\n');
  const expectedDescription = `${descricao || ""}<p><b>Lista de Acessórios:</b><br />\n${accessoriesList}</p>`

  // Compare all relevant fields
  const isMatch =
    wooCommerceData.name === `${modelo} ${marca} ${ano_modelo}` &&
    //wooCommerceData.description === expectedDescription && // this is not working due to the formating coming from woocommerce, something that I couldn't replicate.
    wooCommerceData.sku === autoGestorData.codigo.toString() &&
    parseFloat(wooCommerceData.regular_price) === convertCurrency(preco.venda) && // Convert prices to float for comparison
    //arraysEqual(wooCommerceImages, fotos) && // Of course this will be different, the img change URL when they are uploaded to the fucking wooCommerce........something to figure out later....
    wooCategories.includes(categoryID) &&
    tags.every(tag => wooTags.includes(tag));

  if (!isMatch) {
    console.log(`Data doesn't matche for SKU ${autoGestorData.codigo}`);
    console.log("\n------\n")
  } else {
    console.log(`Data matches for SKU ${autoGestorData.codigo}`);
    console.log("\n------\n")
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

    for (const vehicle of vehicles) {
      const sku = vehicle.codigo.toString();
      const wooProduct = await fetchProductFromWooCommerce(sku);

      if (!verifyDataMatch(vehicle, wooProduct)) {
        await updateProductInWooCommerce(vehicle, wooProduct); // Update the WooCommerce product if there's a mismatch
      } else {}
    }
  } catch (error) {
    console.error("Verification process error:", error);
  }
  console.log("\n\n------------------------------------------------------");
  console.log("END OF VERIFICATION PROCESS");
  console.log("------------------------------------------------------");
}

// Main function to orchestrate the process
async function main() {
  console.log("\n\n------------------------------------------------------");
  console.log("START OF PROCESSING");
  console.log("------------------------------------------------------\n\n");
  try {
    const vehicles = await fetchDataFromAutoGestorWithRetry();

    const createdProducts = await Promise.all(
      vehicles.map(async (vehicle) => {
        const sku = vehicle.codigo.toString();
        const exists = await productExistsInWooCommerce(sku);

        if (!exists) {
          return createProductInWooCommerce(vehicle);
        } else {
          console.log(`Product with SKU [ ${sku} ] already exists in WooCommerce. Skipping creation.`);
          return null;
        }
      })
    );

    // Call checkForChanges to verify and log any data mismatches
    await checkForChanges();

  } catch (error) {
    console.error("Main process error:", error);
  }
  console.log(
    "------------------------------------------------------"
  );
   console.log(
    `
    ⠀⠀⠀⠋⠙⠛⠋⠉⠑⠾⠿⡆⠈⠛⠋⠈⠟⠉⠁⠈⠛⠛⠋⠉⠙⢿⠁⠉⠉⠽⢿⠛⠉⠉⠉⠛⠙⣿⡿⠋⡡⠄⠀⠀⠀⠀⠀⠀⠀⠠
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢇⠀⠀⠀⠀⠀⠀⠀⠿⢆⠀⠘⢁⡞⢡⠀⠀⠀⢀⡄⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⢄⠀⠀⠀⠐⣦⣄⡀⠀⠀⢺⠁⡾⠀⡰⠀⠊⠁⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⡿⠛⠀⠀⢸⢀⠉⠴⠠⢖⣤⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⠀⠀⠀⠸⢈⠀⡀⠀⠈⠉⠓⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠇⡀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⣀⣀⣤⣤⣴⣦⣦⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠰⠋⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⣠⣾⡿⠛⠛⡉⣉⣉⡀⠀⢤⡉⢳⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀
    ⣀⣤⣾⡿⢋⣴⣖⡟⠛⢻⣿⣿⣽⣆⠙⢦⡙⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⠖⠒⠻⠻⠶⣦⣄⠀
    ⠉⣿⢸⠁⣸⣥⣹⠧⡠⣾⣿⣿⣿⣿⣧⡈⢷⣼⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣿⣾⣿⣿⣶⣦⣈⠈⠻⣤
    ⠀⢹⡇⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡟⣫⠀⠙⣿⣿⣿⣿⣷⡄⣽
    ⠀⠀⠳⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣀⣿⣟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
    ⠀⠀⠀⠈⠙⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⠭⠛⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
    ⠀⠀⠀⣼⠉⠓⢦⠀⠀⠉⠩⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠒⡊⠙⠉⠉⠉⠓⠲⠤⡀⠀⠀⠙⠿⣿⣿⣿⣿⣿⣿⣿⠏
    ⠀⠀⠀⠈⢦⡀⠈⡇⠀⠀⡠⠒⠛⢲⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠿⣦⣴⣿⣶⣶⠀⠠⠀⣰⣤⣿⣦⠀⠀⠀⠀⠉⠙⠛⠻⠛⠁⠀
    ⠀⠀⠀⠀⠀⡇⠀⢧⡴⠋⠀⣀⡀⢰⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢛⠃⢀⣄⠀⣿⡿⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀
    ⠀⠀⠀⠀⠀⡇⠀⠉⠀⣰⠋⢱⠃⢸⡁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠊⠟⠋⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠖⠋⠉
    ⠀⠀⠀⠀⠀⢇⠀⣰⡿⠋⠀⠘⢦⠼⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢼⠋⠁⣀⡤⠎
    ⠀⠀⠀⠀⠀⠈⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠌⠀⢀⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠁⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢦⣄⡀⠀⠀⢀⣀⣠⣴⡿⣿⣦⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠛⠻⠿⠉⠉⠉⠉⠉⠑⠋⠙⠻⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⢳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀
  ` 
  );
  console.log(
    "\n\n------------------------------------------------------"
  );
  console.log("END OF PROCESSING");
  console.log("All products created in WooCommerce");
  console.log(
    "------------------------------------------------------\n\n\n"
  );
}

// Run the main function
main();
