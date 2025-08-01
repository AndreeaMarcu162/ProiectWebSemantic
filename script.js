function formatPrepTime(duration) {
  if (!duration) return "-";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration;
  const hours = match[1] ? `${match[1]}h` : "";
  const minutes = match[2] ? `${match[2]} min` : "";
  return [hours, minutes].filter(Boolean).join(" ");
}

let rezultatePas1 = [];

async function pas1() {
  const endpoint = "http://localhost:8080/proiectweb/proxy.php";

  const query = `
    PREFIX : <http://restaurant.ro#>
    PREFIX schema: <http://schema.org/>
    SELECT ?restaurantName ?cuisine ?address ?opening ?specialty ?delivery ?rating ?itemName ?price ?category ?prep ?cal ?veg ?spice 
    WHERE {
      GRAPH :info {
        ?restaurant a schema:Restaurant ;
          schema:name ?restaurantName ;
          schema:servesCuisine ?cuisine ;
          schema:address ?address ;
          schema:openingHours ?opening ;
          :hasSpecialty ?specialty ;
          :hasDeliveryOption ?delivery ;
          schema:aggregateRating [ schema:ratingValue ?rating ] ;
          schema:menu ?item .
        ?item a schema:MenuItem ;
          schema:name ?itemName ;
          schema:price ?price ;
          schema:category ?category ;
          schema:prepTime ?prep ;
          schema:nutrition [ schema:calories ?cal ];
          schema:isVegetarian ?veg ;
          :spiceLevel ?spice .
        FILTER(?category = "Main course")
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json"
      },
      body: query
    });

    if (!response.ok) return;

    const data = await response.json();
    const rezultate = data.results.bindings;
    rezultatePas1 = rezultate;

    if (rezultate.length === 0) {
      document.getElementById("tabel1").innerHTML = "<p style='color:red;'>Nicio înregistrare găsită!</p>";
      return;
    }

    let tabel = `<table border='1'>
      <tr>
        <th>Restaurant</th><th>Bucătărie</th><th>Adresă</th><th>Program</th>
        <th>Specialitate</th><th>Livrare</th><th>Rating</th>
        <th>Preparat</th><th>Preț</th><th>Categorie</th><th>Timp</th>
        <th>Calorii</th><th>Vegetarian</th><th>Picant</th>
      </tr>`;
    rezultate.forEach(r => {
      tabel += `<tr>
        <td>${r.restaurantName.value}</td>
        <td>${r.cuisine.value}</td>
        <td>${r.address.value}</td>
        <td>${r.opening.value}</td>
        <td>${r.specialty.value}</td>
        <td>${r.delivery.value === "true" ? "Da" : "Nu"}</td>
        <td>${r.rating.value}</td>
        <td>${r.itemName.value}</td>
        <td>${r.price.value}</td>
        <td>${r.category.value}</td>
        <td>${formatPrepTime(r.prep.value)}</td>
        <td>${r.cal.value}</td>
        <td>${r.veg.value === "true" ? "Da" : "Nu"}</td>
        <td>${r.spice.value}</td>
      </tr>`;
    });
    tabel += "</table>";
    document.getElementById("tabel1").innerHTML = tabel;

    let jsonldData = rezultate.map(r => {
      return {
        "@context": "http://schema.org",
        "@type": "MenuItem",
        "name": r.itemName.value,
        "price": r.price.value,
        "category": r.category.value,
        "prepTime": r.prep.value,
        "nutrition": {
          "@type": "NutritionInformation",
          "calories": r.cal.value
        },
        "isVegetarian": r.veg.value === "true",
        "spiceLevel": r.spice.value,
        "menuAddOn": {
          "@type": "Restaurant",
          "name": r.restaurantName.value,
          "servesCuisine": r.cuisine.value,
          "address": r.address.value,
          "openingHours": r.opening.value,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": r.rating.value
          },
          "hasSpecialty": r.specialty.value,
          "hasDeliveryOption": r.delivery.value === "true"
        }
      };
    });

    const existent = document.getElementById("jsonld");
    if (existent) existent.remove();

    const jsonLdScript = document.createElement("script");
    jsonLdScript.setAttribute("type", "application/ld+json");
    jsonLdScript.id = "jsonld";
    jsonLdScript.textContent = JSON.stringify(jsonldData, null, 2);
    document.body.appendChild(jsonLdScript);
  } catch {}
}

async function pas2() {
  if (rezultatePas1.length === 0) {
    return;
  }

  const restauranteUnice = new Map();
  const menuItems = [];

  rezultatePas1.forEach(r => {
    const id = r.restaurantName.value.toLowerCase().replace(/\s+/g, '');
    if (!restauranteUnice.has(id)) {
      restauranteUnice.set(id, {
        id,
        name: r.restaurantName.value,
        cuisine: r.cuisine.value,
        address: r.address.value
      });
    }

    menuItems.push({
      name: r.itemName.value,
      price: r.price.value,
      category: r.category.value,
      calories: r.cal.value,
      prepTime: r.prep.value,
      restaurantId: id
    });
  });

  try {
    for (const [id, r] of restauranteUnice) {
      const res = await fetch(`http://localhost:4000/restaurants?id=${id}`);
      const exists = await res.json();
      if (exists.length === 0) {
        await fetch("http://localhost:4000/restaurants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r)
        });
      }
    }

    const allItems = await fetch("http://localhost:4000/menuitems").then(r => r.json());
    for (const item of menuItems) {
      const alreadyExists = allItems.some(existing =>
        existing.name.toLowerCase() === item.name.toLowerCase() &&
        existing.restaurantId === item.restaurantId
      );
      if (!alreadyExists) {
        await fetch("http://localhost:4000/menuitems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item)
        });
      }
    }
  } catch (err) {
  }
}

async function pas3() {
  try {
    const resRestaurants = await fetch("http://localhost:4000/restaurants");
    const restaurants = await resRestaurants.json();

    const resMenu = await fetch("http://localhost:4000/menuitems?prepTime_lte=PT30M");
    const menuItems = await resMenu.json();

    const restaurantMap = {};
    restaurants.forEach(r => {
      restaurantMap[r.id] = r;
    });

    let tabel = `<table border='1'>
      <tr>
        <th>Restaurant</th>
        <th>Preparat</th>
        <th>Preț</th>
        <th>Categorie</th>
        <th>Calorii</th>
        <th>Timp Preparare</th>
      </tr>`;

    menuItems.forEach(item => {
      const rest = restaurantMap[item.restaurantId];
      if (rest) {
        tabel += `<tr>
          <td>${rest.name}</td>
          <td>${item.name}</td>
          <td>${item.price}</td>
          <td>${item.category}</td>
          <td>${item.calories}</td>
          <td>${formatPrepTime(item.prepTime)}</td>
        </tr>`;
      }
    });

    tabel += "</table>";
    document.getElementById("tabel2").innerHTML = tabel;

    const dropdown = document.getElementById("dropdownRestaurante");
    dropdown.innerHTML = '<option value="">-- selectează --</option>';
    restaurants.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      dropdown.appendChild(opt);
    });
  } catch (err) {
  }
}

async function pas4() {
  const nume = document.getElementById("nume").value;
  const pret = document.getElementById("pret").value;
  const categorie = document.getElementById("categorie").value;
  const timp = document.getElementById("timp").value;
  const calorii = document.getElementById("calorii").value;
  const restaurantId = document.getElementById("dropdownRestaurante").value;

  if (!nume || !pret || !categorie || !timp || !calorii || !restaurantId) {
    return;
  }

  const caloriiInt = parseInt(calorii);

  const mutation = `
    mutation {
      createMenuitem(
        name: "${nume}",
        price: "${pret}",
        category: "${categorie}",
        prepTime: "${timp}",
        calories: ${caloriiInt},
        restaurantId: "${restaurantId}"
      ) {
        name
      }
    }
  `;

  try {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: mutation })
    });

    const result = await response.json();
    if (result.errors) {
      return;
    }

  } catch {}
}


async function pas5() {
  const query = `
    query {
      allMenuitems(filter: { calories_gte: 700 }) {
        name
        price
        category
        prepTime
        calories
        restaurantId
      }
    }
  `;

  try {
    const response = await fetch("http://localhost:3000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) return;

    const data = await response.json();
    const items = data.data.allMenuitems;

    const resResponse = await fetch("http://localhost:4000/restaurants");
    const restaurants = await resResponse.json();
    const restaurantMap = {};
    restaurants.forEach(r => {
      restaurantMap[r.id] = r.name;
    });

    let tabel = `<table border='1'>
      <tr>
        <th>Preparat</th>
        <th>Preț</th>
        <th>Categorie</th>
        <th>Calorii</th>
        <th>Timp</th>
        <th>Restaurant</th>
      </tr>`;

    items.forEach(item => {
      tabel += `<tr>
        <td>${item.name}</td>
        <td>${item.price}</td>
        <td>${item.category}</td>
        <td>${item.calories}</td>
        <td>${formatPrepTime(item.prepTime)}</td>
        <td>${restaurantMap[item.restaurantId] || item.restaurantId}</td>
      </tr>`;
    });

    tabel += "</table>";
    document.getElementById("tabel3").innerHTML = tabel;

  } catch {}
}
