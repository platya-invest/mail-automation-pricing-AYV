require("dotenv").config();
const axios = require("axios");
const https = require("https");

const FUND_IDS = ["43", "1", "38", "39", "40", "50"];

const FUND_ID_MAP = {
  1: "6073f1cf-40df-4999-9df3-0072a673d8d9",
  38: "6073f1cf-40df-4999-9df3-0072a673d8d8",
  39: "6073f1cf-40df-4999-9df3-0072a673d8d7",
  40: "6073f1cf-40df-4999-9df3-0072a673d8d6",
  43: "6073f1cf-40df-4999-9df3-0072a673d8d5",
  50: "6073f1cf-40df-4999-9df3-0072a673d8d10",
};

const DEFAULT_RENTABILITY_FIELD = "rentabilidad365";

class RestProcessor {
  constructor() {
    this.baseUrl = process.env.API_BASE_URL || "https://apifondosmpf.accivalores.com";
    this.dataEndpoint = "/AyV/v3/Pocket/GetProfitabilityByFund";
    this.authEndpoint = "/AyV/Autenticacion/GenerateAppToken";
    this.bearerToken = null;

    this.authPassword = process.env.AUTH_PASSWORD;
    this.authCodigoApp = process.env.AUTH_CODIGO_APP;

    this.clientConfig = {};
    this.loadCertificates();
  }

  loadCertificates() {
    const certContent = process.env.CLIENT_CERT_CONTENT;
    const keyContent = process.env.CLIENT_KEY_CONTENT;

    if (!certContent || !keyContent) {
      console.log(
        "ADVERTENCIA: Rutas de certificados de cliente (mTLS) no configuradas. Continuando sin SSL de cliente."
      );
      return;
    }

    try {
      this.clientConfig = {
        httpsAgent: new https.Agent({
          cert: certContent,
          key: keyContent,
        }),
      };
      console.log("Certificados de cliente (mTLS) cargados exitosamente.");
    } catch (error) {
      console.error(
        "ERROR: No se pudieron cargar los archivos de certificado. Verifique las rutas:",
        error.message
      );
      throw new Error("Fallo al cargar certificados SSL.");
    }
  }

  async getBearerToken() {
    if (!this.authPassword || !this.authCodigoApp) {
      throw new Error("AUTH_PASSWORD o AUTH_CODIGO_APP no configurados en .env.");
    }

    console.log("Intentando obtener Bearer Token...");

    const url = `${this.baseUrl}${this.authEndpoint}`;
    const payload = {
      password: this.authPassword,
      codigo_App: this.authCodigoApp,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        ...this.clientConfig,
      });

      if (response.data && response.data.token) {
        this.bearerToken = response.data.token;
        console.log("Bearer Token obtenido exitosamente.");
        return this.bearerToken;
      } else {
        throw new Error("Respuesta de autenticación no válida: falta el token.");
      }
    } catch (error) {
      console.error("Error fatal al obtener el Bearer Token:", error.message);
      throw new Error(
        `Fallo la autenticación con la API. Revise credenciales y mTLS: ${error.message}`
      );
    }
  }

  getYesterdayDate() {
    const today = new Date();
    today.setDate(today.getDate() - 1);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  mapResponseToFundData(apiResponse, fundId, rentabilityField) {
    const apiData = apiResponse.data;

    if (!apiData || apiData.fondo === undefined || apiData.vlr_Unidad === undefined) {
      console.log(`Datos incompletos para el fondo ${fundId}.`);
      return null;
    }

    const uuidFund = FUND_ID_MAP[fundId];
    if (!uuidFund) {
      console.error(`ERROR DE MAPEO: ID de fondo numérico ${fundId} no encontrado en FUND_ID_MAP.`);
      return null;
    }

    let targetIncomeValue = null;
    let formattedTargetIncome = null;

    if (fundId === "50") {
      formattedTargetIncome = "Fondo nuevo";
    } else {
      targetIncomeValue = apiData[rentabilityField];
      if (targetIncomeValue === undefined || targetIncomeValue === null) {
        console.warn(
          `Campo de rentabilidad '${rentabilityField}' no encontrado en la respuesta para Fondo ${fundId}.`
        );
        formattedTargetIncome = null;
      } else {
        let labelSuffix;
        if (fundId === "43") {
          labelSuffix = "E.A. Últimos 6 meses";
        } else {
          labelSuffix = "E.A. Último año";
        }
        formattedTargetIncome = `${targetIncomeValue}% ${labelSuffix}`;
      }
    }

    return {
      idFund: uuidFund,
      date: apiData.fecha.split("T")[0],
      price: apiData.vlr_Unidad,
      targetIncome: targetIncomeValue,
      formattedTargetIncome: formattedTargetIncome,
    };
  }

  async fetchFundData(fundId, date) {
    if (!this.bearerToken) {
      throw new Error("Token de autenticación no disponible.");
    }

    const url = `${this.baseUrl}${this.dataEndpoint}?Fondo=${fundId}&Fecha=${date}`;

    console.log(url);

    try {
      console.log(`Consultando API para Fondo ${fundId} en ${date}...`);

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        ...this.clientConfig,
      });

      if (response.data.succeeded) {
        console.log(response.data);
        return response.data;
      } else {
        console.error(`API falló para el Fondo ${fundId}: ${response.data.message}`);
        return null;
      }
    } catch (error) {
      console.error(`Error de red al consultar API para Fondo ${fundId}:`, error.message);
      return null;
    }
  }

  async processDaily() {
    console.log("Starting REST API fund processing...");

    await this.getBearerToken();

    const date = this.getYesterdayDate();
    const allFondosData = [];

    for (const fundId of FUND_IDS) {
      let rentabilityField = DEFAULT_RENTABILITY_FIELD;

      if (fundId === "43") {
        rentabilityField = "rentabilidad180";
      }

      const apiResult = await this.fetchFundData(fundId, date);

      if (apiResult) {
        const mappedData = this.mapResponseToFundData(apiResult, fundId, rentabilityField);
        if (mappedData) {
          allFondosData.push(mappedData);
        }
      }
    }

    return {
      success: allFondosData.length > 0,
      fondosProcessed: allFondosData.length,
      allFondosData: allFondosData,
    };
  }
}

module.exports = RestProcessor;
