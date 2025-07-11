require('dotenv').config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Inicializar Firebase Admin si no está ya inicializado
if (!admin.apps.length) {
  // Construir credenciales desde variables de entorno
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  
  console.log('🔥 Firebase inicializado con credenciales desde variables de entorno');
}

const db = getFirestore();
db.settings({
  databaseId: process.env.DATABASE_ID,
});

async function saveToFirebase(fondosData) {
  try {
    const priceUnitsRef = db.collection("priceUnits");
    const fundsRef = db.collection("funds");
    console.log("🔥 Guardando datos en Firebase...");

    if (!Array.isArray(fondosData) || fondosData.length === 0) {
      console.log("⚠️  No hay datos de fondos para guardar");
      return;
    }

    let savedCount = 0;
    let errorCount = 0;

    // Procesar cada fondo
    for (const fondo of fondosData) {
      try {
        const { idFund, date, price } = fondo;
        
        if (!idFund || !date || price === undefined) {
          console.log(`⚠️  Datos incompletos para fondo:`, fondo);
          errorCount++;
          continue;
        }

        // 1. Guardar en priceUnits histórico (como antes)
        const historicalRef = priceUnitsRef
          .doc(idFund)
          .collection("historical")
          .doc(date);

        const historicalData = {
          date: date,
          price: price
        };

        await historicalRef.set(historicalData, { merge: true });
        console.log(`✅ Histórico guardado: priceUnits/${idFund}/historical/${date} - Precio: ${price}`);

        // 2. Actualizar campo "unit" en la colección funds
        const fundRef = fundsRef.doc(idFund);
        
        await fundRef.update({
          unit: price
        });
        
        console.log(`✅ Fondo actualizado: funds/${idFund} - unit: ${price}`);
        savedCount++;

      } catch (error) {
        console.error(`❌ Error al guardar fondo ${fondo.idFund}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen de guardado:`);
    console.log(`   ✅ Fondos guardados exitosamente: ${savedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📈 Total procesados: ${fondosData.length}`);
    
    if (savedCount > 0) {
      console.log("🔥 Datos guardados exitosamente en Firebase");
    }

    return {
      success: savedCount > 0,
      savedCount,
      errorCount,
      totalProcessed: fondosData.length
    };

  } catch (error) {
    console.error("❌ Error general al guardar en Firebase:", error);
    throw error;
  }
}

module.exports = { saveToFirebase }; 