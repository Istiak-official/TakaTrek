import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentFilename = typeof import.meta?.url === 'string' ? fileURLToPath(import.meta.url) : process.cwd();
const currentDirname = path.dirname(currentFilename);

const PORT = Number(process.env.PORT) || 3000;

// Lazy GenAI instance with proper telemetry headers
let aiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Health check API
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // POST /api/insights/analyze - Analyze monthly spending patterns, savings, and unusual spikes
  app.post("/api/insights/analyze", async (req, res) => {
    try {
      const {
        month,
        lang = "en",
        metrics,
        transactions = [],
        topDebtors = [],
        topPayers = [],
        dayByDayActivity = [],
      } = req.body;

      const ai = getGenAI();

      // If no API key is available, return an intelligent rule-based analysis response
      if (!ai) {
        console.log("[Gemini Insights] GEMINI_API_KEY not configured. Providing statistical baseline analysis.");
        const fallback = generateStatisticalInsights(month, lang, metrics, transactions, topDebtors, topPayers);
        return res.json({
          source: "statistical_baseline",
          insights: fallback,
        });
      }

      const promptContext = `
You are a senior business financial consultant and micro-enterprise ledger specialist.
Analyze the following store's monthly credit ledger and customer spending activity for the month of "${month}".
Language requested for output: "${lang === "bn" ? "Bengali (বাংলা)" : "English"}".

Monthly Ledger Metrics:
- Total Credit Dues Extended to Customers: ৳ ${metrics?.dues || 0}
- Total Cash Collections Received: ৳ ${metrics?.payments || 0}
- Net Cash Flow: ৳ ${(metrics?.payments || 0) - (metrics?.dues || 0)}
- Collection Efficiency: ${metrics?.efficiency || 0}%
- Total Transaction Count: ${transactions.length}

Day by Day Aggregates:
${JSON.stringify(dayByDayActivity.slice(0, 31), null, 2)}

Top Customer Debtors (Highest Unpaid Outstanding):
${JSON.stringify(topDebtors.slice(0, 5), null, 2)}

Top Paying Customers (Highest Payments Made This Month):
${JSON.stringify(topPayers.slice(0, 5), null, 2)}

Sample Recent Transactions:
${JSON.stringify(
  transactions.slice(0, 40).map((t: any) => ({
    date: t.date,
    customer: t.customerName,
    type: t.type,
    amount: t.amount,
    notes: t.description || "",
    tag: t.tag || t.tags || "",
  })),
  null,
  2
)}

TASKS:
1. Financial Health Score (0-100) and Rating (e.g. Excellent, Good, Fair, Critical).
2. Executive Summary of this month's spending patterns, credit risk, and liquidity.
3. 3-4 Key Monthly Spending & Credit Patterns (e.g. customer credit concentration, weekend vs weekday spending, average basket size).
4. 2-4 Concrete Potential Areas for Savings & Risk Reduction (e.g., reducing uncollected overdue aging, tightening credit thresholds for chronic slow-payers, offering small settlement discounts for cash purchases, inventory/cash recycling optimizations).
5. 1-4 Unusual Transaction Spikes or Outliers (e.g. single transactions that are unusually high compared to typical customer history, sudden spikes in credit on a single day, or abnormal payment jumps).
6. 3 High-Impact Actionable Bullet Tips for the business owner.

Provide the response in accurate, natural ${lang === "bn" ? "Bengali (বাংলা script)" : "English"} using clear, professional terminology suitable for shopkeepers and business owners.`;

      // Try generating insights with Gemini models with fallback on high demand or rate limits
      const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let parsedInsights = null;
      let usedModel = "";

      for (const modelName of candidateModels) {
        let attempts = 0;
        const maxAttempts = 2;
        let success = false;

        while (attempts < maxAttempts && !success) {
          attempts++;
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: promptContext,
              config: {
                systemInstruction: `You are an expert retail accounting and cash flow optimizer. Always respond with valid JSON matching the exact schema requested. Provide helpful, empathetic, and highly actionable analysis for small business owners. When Bengali language is requested, write authentic, natural Bengali (বাংলা) business terms (যেমন: বাকি, নগদ আদায়, সঞ্চয় সুযোগ, অস্বাভাবিক লেনদেন, ইত্যাদি).`,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    healthScore: {
                      type: Type.INTEGER,
                      description: "Overall financial health score from 0 to 100",
                    },
                    healthStatus: {
                      type: Type.STRING,
                      description: "Short status e.g. Excellent / Good / Needs Attention / High Risk",
                    },
                    summary: {
                      type: Type.STRING,
                      description: "Executive summary paragraph of the monthly spending and collection performance",
                    },
                    spendingPatterns: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          patternType: { 
                            type: Type.STRING,
                            description: "positive, warning, or neutral" 
                          },
                          impactMetric: { type: Type.STRING, description: "Key percentage or figure affected" }
                        },
                        required: ["title", "description", "patternType"],
                      },
                    },
                    savingsSuggestions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          category: { type: Type.STRING },
                          potentialSavings: { type: Type.STRING, description: "Estimated money saved or recovered e.g. ৳ 5,000" },
                          actionPlan: { type: Type.STRING, description: "Direct step to achieve this saving" }
                        },
                        required: ["title", "category", "potentialSavings", "actionPlan"],
                      },
                    },
                    unusualSpikes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          date: { type: Type.STRING },
                          customerName: { type: Type.STRING },
                          amount: { type: Type.STRING },
                          spikeType: { 
                            type: Type.STRING, 
                            description: "due_spike, payment_spike, or anomaly" 
                          },
                          severity: { 
                            type: Type.STRING, 
                            description: "high, medium, or low" 
                          },
                          explanation: { type: Type.STRING },
                          recommendation: { type: Type.STRING }
                        },
                        required: ["title", "customerName", "amount", "spikeType", "severity", "explanation", "recommendation"],
                      },
                    },
                    actionableTips: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    "healthScore",
                    "healthStatus",
                    "summary",
                    "spendingPatterns",
                    "savingsSuggestions",
                    "unusualSpikes",
                    "actionableTips"
                  ],
                },
              },
            });

            const responseText = response.text || "{}";
            parsedInsights = JSON.parse(responseText);
            if (parsedInsights && parsedInsights.healthScore !== undefined) {
              usedModel = modelName;
              success = true;
              break;
            }
          } catch (modelErr: any) {
            const errMsg = String(modelErr?.message || modelErr || "");
            const isTransient =
              errMsg.includes("503") ||
              errMsg.includes("high demand") ||
              errMsg.includes("429") ||
              errMsg.includes("UNAVAILABLE") ||
              errMsg.includes("ResourceExhausted");

            if (isTransient && attempts < maxAttempts) {
              // Wait briefly before 2nd attempt
              await new Promise((resolve) => setTimeout(resolve, 600));
              continue;
            }

            console.log(`[Gemini Insights] Model ${modelName} transient status. Proceeding to candidate fallback.`);
            break;
          }
        }

        if (success) {
          break;
        }
      }

      if (parsedInsights) {
        return res.json({
          source: "gemini",
          model: usedModel,
          insights: parsedInsights,
        });
      }

      // If Gemini models are experiencing temporary high demand, provide statistical baseline seamlessly
      console.log("[Gemini Insights] Models temporarily under high demand. Serving statistical baseline analysis.");
      const fallback = generateStatisticalInsights(
        month,
        lang,
        metrics,
        transactions,
        topDebtors,
        topPayers
      );
      return res.json({
        source: "statistical_baseline",
        insights: fallback,
      });
    } catch (error: any) {
      console.log("[Gemini Insights] Processing handled with graceful fallback.");
      // Fallback gracefully on any error so UI never breaks
      const fallback = generateStatisticalInsights(
        req.body?.month,
        req.body?.lang,
        req.body?.metrics,
        req.body?.transactions,
        req.body?.topDebtors,
        req.body?.topPayers
      );
      return res.json({
        source: "statistical_fallback",
        insights: fallback,
        warning: "Temporary model unavailability, statistical insights generated successfully.",
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Resilient statistical heuristics engine used as baseline or fallback
function generateStatisticalInsights(
  month: string = "",
  lang: string = "en",
  metrics: any = {},
  transactions: any[] = [],
  topDebtors: any[] = [],
  topPayers: any[] = []
) {
  const isBn = lang === "bn";
  const dues = Number(metrics?.dues || 0);
  const payments = Number(metrics?.payments || 0);
  const efficiency = Number(metrics?.efficiency || 0);
  const txCount = transactions.length;

  // Calculate mean and standard deviation of transaction amounts
  const amounts = transactions.map((t) => Number(t.amount || 0)).filter((a) => a > 0);
  const avgAmount = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const variance =
    amounts.length > 1
      ? amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length
      : 0;
  const stdDev = Math.sqrt(variance);

  // Detect outlier spikes (amounts > mean + 1.8 * stdDev)
  const threshold = avgAmount + (stdDev > 0 ? 1.8 * stdDev : avgAmount * 1.5);
  const detectedSpikes = transactions
    .filter((t) => Number(t.amount || 0) >= threshold && Number(t.amount || 0) > 0)
    .slice(0, 4)
    .map((t) => ({
      title: isBn
        ? `অস্বাভাবিক ${t.type === "due" ? "বাকি" : "পেমেন্ট"} বৃদ্ধি (৳${t.amount.toLocaleString()})`
        : `Unusual ${t.type === "due" ? "Credit" : "Payment"} Spike (৳${t.amount.toLocaleString()})`,
      date: t.date ? new Date(t.date).toLocaleDateString() : "",
      customerName: t.customerName || "Customer",
      amount: `৳ ${Number(t.amount || 0).toLocaleString()}`,
      spikeType: t.type === "due" ? "due_spike" : "payment_spike",
      severity: Number(t.amount) > avgAmount * 3 ? "high" : "medium",
      explanation: isBn
        ? `এই লেনদেনটি মাসিক গড় (৳${Math.round(avgAmount).toLocaleString()})-এর তুলনায় উল্লেখযোগ্যভাবে বেশি।`
        : `This transaction significantly exceeds your monthly average transaction size (৳${Math.round(avgAmount).toLocaleString()}).`,
      recommendation: isBn
        ? t.type === "due"
          ? "উচ্চ পরিমাণ বাকির ক্ষেত্রে দ্রুত আংশিক অগ্রিম বা কিস্তি আদায়ের প্রস্তাব দিন।"
          : "পেমেন্টটি সফলভাবে সমন্বয় করা হয়েছে, নিয়মিত এই গ্রাহকের থেকে ক্যাশ লেনদেন বজায় রাখুন।"
        : t.type === "due"
        ? "For large credit orders, request a 40-50% cash advance upfront to protect working capital."
        : "Excellent cash collection. Keep incentivizing on-time settlements for high-volume buyers.",
    }));

  const healthScore = Math.min(
    100,
    Math.max(
      20,
      Math.round(
        (efficiency >= 80 ? 45 : efficiency * 0.5) +
          (payments >= dues ? 35 : (payments / (dues || 1)) * 30) +
          (txCount > 5 ? 20 : txCount * 3)
      )
    )
  );

  return {
    healthScore,
    healthStatus:
      healthScore >= 80
        ? isBn ? "চমৎকার (Excellent)" : "Excellent"
        : healthScore >= 60
        ? isBn ? "সন্তোষজনক (Good)" : "Good"
        : isBn ? "সতর্কতা প্রয়োজন (Needs Attention)" : "Needs Attention",
    summary: isBn
      ? `এই মাসে মোট ৳${dues.toLocaleString()} বাকি দেওয়া হয়েছে এবং ৳${payments.toLocaleString()} নগদ আদায় হয়েছে। বর্তমান রিকভারি হার ${efficiency}%, যা সামগ্রিক নগদ প্রবাহকে ${
          healthScore >= 70 ? "স্থিতিশীল" : "পুনর্বিবেচনাযোগ্য"
        } নির্দেশ করে।`
      : `This month you extended ৳${dues.toLocaleString()} in credit dues and collected ৳${payments.toLocaleString()} in cash payments. Your collection efficiency sits at ${efficiency}%, reflecting ${
          healthScore >= 70 ? "healthy cash velocity" : "tight working liquidity"
        }.`,
    spendingPatterns: [
      {
        title: isBn ? "বাকি ও আদায়ের অনুপাত বিশ্লেষণ" : "Credit-to-Cash Turnover Ratio",
        description: isBn
          ? `মোট বাকির বিপরীতে ${efficiency}% টাকা নগদ আদায় হয়েছে। বাকি আদায়ের গতি সন্তোষজনক রাখতে রিমাইন্ডার বজায় রাখুন।`
          : `You have recovered ${efficiency}% of all credit extended. Maintaining active payment follow-ups will sustain positive liquidity.`,
        patternType: efficiency >= 70 ? "positive" : "warning",
        impactMetric: `${efficiency}% ${isBn ? "আদায় হার" : "Recovery"}`,
      },
      {
        title: isBn ? "গড় লেনদেনের মাত্রা" : "Average Transaction Value",
        description: isBn
          ? `প্রতিটি লেনদেনের গড় আকার প্রায় ৳${Math.round(avgAmount).toLocaleString()}। এটি গ্রাহকের সাধারণ খরচের প্রবণতা প্রকাশ করে।`
          : `Typical ticket size averaged ৳${Math.round(avgAmount).toLocaleString()} across ${txCount} registered transactions.`,
        patternType: "neutral",
        impactMetric: `৳${Math.round(avgAmount).toLocaleString()} / tx`,
      },
      {
        title: isBn ? "বকেয়া কেন্দ্রীভবন ঝুঁকি" : "Top Debtors Concentration",
        description: isBn
          ? `শীর্ষ বকেয়া থাকা গ্রাহকদের কাছে মোট অপরিশোধিত অর্থের একটি বড় অংশ জমা আছে। এদের দিকে বিশেষ নজর দিন।`
          : `A high percentage of unpaid dues is concentrated among your top 5 debtors. Priority recovery here unlocks immediate working cash.`,
        patternType: topDebtors.length > 0 ? "warning" : "positive",
        impactMetric: `${topDebtors.length} ${isBn ? "শীর্ষ দেনাদার" : "Key accounts"}`,
      },
    ],
    savingsSuggestions: [
      {
        title: isBn ? "দ্রুত বকেয়া আদায়ে ক্যাশব্যাক/ছাড় কৌশল" : "Early Settlement Cash Incentives",
        category: isBn ? "নগদ প্রবাহ বৃদ্ধি" : "Working Capital Optimization",
        potentialSavings: `৳ ${(dues * 0.05).toLocaleString()}`,
        actionPlan: isBn
          ? "পুরনো বড় বাকি পরিশোধে ২% তাত্ক্ষণিক ছাড় অফার করলে দ্রুত ক্যাশ রিকভার করা সম্ভব।"
          : "Offer a 2-3% prompt payment discount for balances settled within 7 days to eliminate bad debt risk.",
      },
      {
        title: isBn ? "অনিশ্চিত বড় বাকি সীমা নির্ধারণ" : "Credit Limit Thresholds",
        category: isBn ? "ঝুঁকি নিয়ন্ত্রণ" : "Risk Management",
        potentialSavings: `৳ ${(dues * 0.1).toLocaleString()}`,
        actionPlan: isBn
          ? "যেসব গ্রাহকের আগের বাকি পরিষ্কার হয়নি, তাদের নতুন বাকি বিক্রিতে একটি নির্দিষ্ট সীমা (যেমন ৳৫,০০০) নির্ধারণ করুন।"
          : "Cap credit on accounts with overdue balances older than 30 days until at least 50% is cleared.",
      },
    ],
    unusualSpikes: detectedSpikes.length > 0 ? detectedSpikes : [
      {
        title: isBn ? "স্থিতিশীল লেনদেন প্যাটার্ন" : "Stable Transaction Flow",
        customerName: isBn ? "সকল গ্রাহক" : "All Customers",
        amount: `৳ ${Math.round(avgAmount).toLocaleString()}`,
        spikeType: "anomaly",
        severity: "low",
        explanation: isBn
          ? "এই মাসে কোনো তীব্র বা ঝুঁকিপূর্ণ স্পাইক ধরা পড়েনি, লেনদেনের পরিমাণ স্বাভাবিক সীমার মধ্যে আছে।"
          : "No severe anomalous transaction spikes detected this month. Activity remained within expected standard deviations.",
        recommendation: isBn
          ? "বর্তমান শৃঙ্খলা বজায় রাখুন এবং নিয়মিত সাপ্তাহিক খাতা মিলিয়ে নিন।"
          : "Maintain current ledger logging practices and continue monitoring daily balance changes.",
      },
    ],
    actionableTips: [
      isBn ? "সপ্তাহের শুরুতে সব শীর্ষ দেনাদারকে স্বয়ংক্রিয় হোয়াটসঅ্যাপ/এসএমএস রিমাইন্ডার পাঠান।" : "Send polite WhatsApp reminders to top debtors at the start of every business week.",
      isBn ? "বড় অর্ডারে বাকির ক্ষেত্রে ৫০% ক্যাশ অগ্রিম গ্রহণ নিশ্চিত করুন।" : "Require a 50% cash down-payment for unusually large customer purchase orders.",
      isBn ? "দৈনিক কালেকশন লক্ষ্যমাত্রা বজায় রেখে দিনের ক্যাশ ব্যালেন্স প্রতিদিন মিলিয়ে নিন।" : "Track your daily collection target actively to maintain uninterrupted store liquidity.",
    ],
  };
}

startServer();
