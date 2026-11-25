import "dotenv/config";
import express from "express";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";

const ALLOWED_CATEGORIES = new Set([
  "Produce",
  "Bakery",
  "Dairy & Chilled",
  "Dry Goods",
  "Oils & Condiments",
  "Meat & Protein",
]);

const ALLOWED_PACKAGING = new Set(["Unsealed", "Resealable", "Airtight"]);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "64kb" }));

  app.post("/api/products/lookup", async (req, res) => {
    const rawName = typeof req.body?.productName === "string" ? req.body.productName.trim() : "";
    const packagingHint =
      typeof req.body?.packagingHint === "string" ? req.body.packagingHint.trim() : "";

    if (!rawName || rawName.length > 140) {
      res.status(400).json({
        error: "Please enter a valid product name (1 to 140 characters).",
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured. Please add it in Settings > Secrets to use AI product spec lookup.",
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Estimate realistic food-science pantry storage specifications for the food product: "${rawName}"${
        packagingHint ? ` (packaging context: "${packagingHint}")` : ""
      }.
Assume a typical ambient kitchen pantry (~20.5°C, 48% RH) unless the product is naturally perishable at room temperature (in which case give its realistic ambient pantry shelf life in days, e.g., 0.25 to 2 days for dairy/meat, 3 to 7 days for produce/bakery, 30 to 365 days for dry goods/oils).
Keep vocRiskNote concise (under 130 characters), describing primary spoilage mechanism or BME688 VOC/moisture sensitivity.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are a food preservation and environmental sensor specialist. Return strictly structured JSON matching the schema with accurate shelf-life and humidity/temperature storage specifications.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              canonicalName: {
                type: Type.STRING,
                description: "Clean standardized food product name.",
              },
              category: {
                type: Type.STRING,
                description:
                  "Must be exactly one of: Produce, Bakery, Dairy & Chilled, Dry Goods, Oils & Condiments, Meat & Protein.",
              },
              recommendedPackaging: {
                type: Type.STRING,
                description: "Must be exactly one of: Unsealed, Resealable, Airtight.",
              },
              nominalShelfLifeDays: {
                type: Type.NUMBER,
                description:
                  "Expected shelf life in days at normal kitchen pantry conditions (20.5C, 48% RH).",
              },
              optimalTempC: {
                type: Type.NUMBER,
                description: "Optimal storage temperature in degrees Celsius.",
              },
              optimalRhMin: {
                type: Type.NUMBER,
                description: "Optimal minimum relative humidity percentage (10-95).",
              },
              optimalRhMax: {
                type: Type.NUMBER,
                description: "Optimal maximum relative humidity percentage (10-95).",
              },
              vocRiskNote: {
                type: Type.STRING,
                description:
                  "Brief note under 130 characters on spoilage VOCs, mold, or moisture sensitivity.",
              },
            },
            required: [
              "canonicalName",
              "category",
              "recommendedPackaging",
              "nominalShelfLifeDays",
              "optimalTempC",
              "optimalRhMin",
              "optimalRhMax",
              "vocRiskNote",
            ],
          },
        },
      });

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;

      const category = ALLOWED_CATEGORIES.has(String(parsed.category))
        ? (String(parsed.category) as string)
        : "Produce";

      const recommendedPackaging = ALLOWED_PACKAGING.has(String(parsed.recommendedPackaging))
        ? (String(parsed.recommendedPackaging) as string)
        : "Resealable";

      const shelfLifeNum = Number(parsed.nominalShelfLifeDays);
      const nominalShelfLifeDays = Number.isFinite(shelfLifeNum)
        ? Number(Math.max(0.25, Math.min(1095, shelfLifeNum)).toFixed(2))
        : 5;

      const tempNum = Number(parsed.optimalTempC);
      const optimalTempC = Number.isFinite(tempNum)
        ? Number(Math.max(-5, Math.min(30, tempNum)).toFixed(1))
        : 18;

      const rhMinNum = Number(parsed.optimalRhMin);
      const rhMaxNum = Number(parsed.optimalRhMax);
      const optimalRhMin = Number.isFinite(rhMinNum)
        ? Math.round(Math.max(15, Math.min(85, rhMinNum)))
        : 40;
      const optimalRhMax = Number.isFinite(rhMaxNum)
        ? Math.round(Math.max(optimalRhMin + 5, Math.min(95, rhMaxNum)))
        : 65;

      const specs = {
        canonicalName:
          typeof parsed.canonicalName === "string" && parsed.canonicalName.trim()
            ? parsed.canonicalName.trim().slice(0, 100)
            : rawName,
        category,
        recommendedPackaging,
        nominalShelfLifeDays,
        optimalTempC,
        optimalRhMin,
        optimalRhMax,
        vocRiskNote:
          typeof parsed.vocRiskNote === "string"
            ? parsed.vocRiskNote.trim().slice(0, 160)
            : "Monitor ambient temperature, RH, and VOC buildup.",
      };

      res.json({ specs });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to look up product specifications.";
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`PantrySense BME688 server listening on port ${port}`);
  });
}

startServer();
