import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Choose application root correctly for dev and packaged mode:
// - dev: __dirname is project root
// - production (Electron): APP_ROOT is set from electron/main.js path
const baseDir = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : path.resolve(__dirname);

// File paths for all modules
const EXPENSES_FILE = path.join(baseDir, "expenses.json");
const PROCUREMENT_FILE = path.join(baseDir, "procurement-advances.json");
const LOANS_FILE = path.join(baseDir, "staff-loans.json");
const CREDITS_FILE = path.join(baseDir, "credit-purchases.json");

// Initialize Firebase if config exists
let db: any = null;
try {
  const configPath = path.join(baseDir, "firebase-applet-config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
  const app = initializeApp(config);
  db = getFirestore(app, config.firestoreDatabaseId);
  console.log("Firebase initialized on backend");
} catch (error) {
  console.log("Firebase not initialized or config missing:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // GET /api/expenses - Get all expenses from local file
  app.get("/api/expenses", async (req, res) => {
    try {
      let expenses = [];
      try {
        const data = await fs.readFile(EXPENSES_FILE, "utf-8");
        expenses = JSON.parse(data);
      } catch (err) {
        // If file doesn't exist, return empty array
        expenses = [];
      }
      if (!Array.isArray(expenses)) {
        expenses = [];
      }
      expenses.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      res.json(expenses);
    } catch (error) {
      console.error("Failed to read expenses:", error);
      res.status(500).json({ error: "Failed to read expenses" });
    }
  });

  // POST /api/expenses - Save new expense locally and optionally to Firebase
  app.post("/api/expenses", async (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid expense payload' });
    }

    const serverExpense = {
      ...payload,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };

    try {
      let expenses = [];
      try {
        const data = await fs.readFile(EXPENSES_FILE, "utf-8");
        expenses = JSON.parse(data);
      } catch (err) {
        expenses = [];
      }

      if (!Array.isArray(expenses)) {
        expenses = [];
      }

      expenses.push(serverExpense);
      await fs.writeFile(EXPENSES_FILE, JSON.stringify(expenses, null, 2), "utf-8");
      console.log("Saved expense locally", serverExpense.id);

      if (db) {
        try {
          await addDoc(collection(db, "expenses"), serverExpense);
          console.log("Synced expense to Firebase", serverExpense.id);
        } catch (firebaseError) {
          console.error("Firebase sync failed (offline or error):", firebaseError);
        }
      }

      res.json({ message: "Expense saved successfully", expense: serverExpense });
    } catch (error) {
      console.error("Failed to save expense:", error);
      res.status(500).json({ error: "Failed to save expense" });
    }
  });

  // DELETE /api/expenses/:id - optional cleanup route
  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let expenses = [];
      try {
        const data = await fs.readFile(EXPENSES_FILE, "utf-8");
        expenses = JSON.parse(data);
      } catch (err) {
        expenses = [];
      }
      if (!Array.isArray(expenses)) expenses = [];
      const filtered = expenses.filter((expense) => expense.id !== id);
      await fs.writeFile(EXPENSES_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ message: "Expense deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ============================================================================
  // PROCUREMENT ADVANCE ROUTES
  // ============================================================================
  
  // GET /api/procurement-advances - Get all procurement advances
  app.get("/api/procurement-advances", async (req, res) => {
    try {
      let advances = [];
      try {
        const data = await fs.readFile(PROCUREMENT_FILE, "utf-8");
        advances = JSON.parse(data);
      } catch (err) {
        advances = [];
      }
      if (!Array.isArray(advances)) advances = [];
      advances.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      res.json(advances);
    } catch (error) {
      console.error("Failed to read procurement advances:", error);
      res.status(500).json({ error: "Failed to read procurement advances" });
    }
  });

  // POST /api/procurement-advances - Create new advance
  app.post("/api/procurement-advances", async (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid advance payload' });
    }

    const serverAdvance = {
      ...payload,
      id: Date.now().toString(),
      createdAt: Date.now(),
      adjustments: []
    };

    try {
      let advances = [];
      try {
        const data = await fs.readFile(PROCUREMENT_FILE, "utf-8");
        advances = JSON.parse(data);
      } catch (err) {
        advances = [];
      }
      if (!Array.isArray(advances)) advances = [];
      advances.push(serverAdvance);
      await fs.writeFile(PROCUREMENT_FILE, JSON.stringify(advances, null, 2), "utf-8");
      console.log("Saved procurement advance", serverAdvance.id);
      res.json({ message: "Advance saved successfully", advance: serverAdvance });
    } catch (error) {
      console.error("Failed to save procurement advance:", error);
      res.status(500).json({ error: "Failed to save advance" });
    }
  });

  // PUT /api/procurement-advances/:id - Update advance with adjustment
  app.put("/api/procurement-advances/:id", async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    try {
      let advances = [];
      try {
        const data = await fs.readFile(PROCUREMENT_FILE, "utf-8");
        advances = JSON.parse(data);
      } catch (err) {
        advances = [];
      }
      if (!Array.isArray(advances)) advances = [];
      
      const index = advances.findIndex(a => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Advance not found" });
      }

      if (payload.adjustment) {
        if (!advances[index].adjustments) advances[index].adjustments = [];
        advances[index].adjustments.push({
          id: Date.now().toString(),
          ...payload.adjustment,
          adjustedAt: Date.now()
        });
      }
      if (payload.status) advances[index].status = payload.status;
      advances[index].updatedAt = Date.now();

      await fs.writeFile(PROCUREMENT_FILE, JSON.stringify(advances, null, 2), "utf-8");
      res.json({ message: "Advance updated successfully", advance: advances[index] });
    } catch (error) {
      console.error("Failed to update advance:", error);
      res.status(500).json({ error: "Failed to update advance" });
    }
  });

  // DELETE /api/procurement-advances/:id - Delete advance
  app.delete("/api/procurement-advances/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let advances = [];
      try {
        const data = await fs.readFile(PROCUREMENT_FILE, "utf-8");
        advances = JSON.parse(data);
      } catch (err) {
        advances = [];
      }
      if (!Array.isArray(advances)) advances = [];
      const filtered = advances.filter((a) => a.id !== id);
      await fs.writeFile(PROCUREMENT_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ message: "Advance deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete advance" });
    }
  });

  // ============================================================================
  // STAFF LOAN ROUTES
  // ============================================================================
  
  // GET /api/staff-loans - Get all loans
  app.get("/api/staff-loans", async (req, res) => {
    try {
      let loans = [];
      try {
        const data = await fs.readFile(LOANS_FILE, "utf-8");
        loans = JSON.parse(data);
      } catch (err) {
        loans = [];
      }
      if (!Array.isArray(loans)) loans = [];
      loans.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      res.json(loans);
    } catch (error) {
      console.error("Failed to read loans:", error);
      res.status(500).json({ error: "Failed to read loans" });
    }
  });

  // POST /api/staff-loans - Create new loan
  app.post("/api/staff-loans", async (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid loan payload' });
    }

    const serverLoan = {
      ...payload,
      id: Date.now().toString(),
      createdAt: Date.now(),
      repayments: [],
      status: 'Unpaid'
    };

    try {
      let loans = [];
      try {
        const data = await fs.readFile(LOANS_FILE, "utf-8");
        loans = JSON.parse(data);
      } catch (err) {
        loans = [];
      }
      if (!Array.isArray(loans)) loans = [];
      loans.push(serverLoan);
      await fs.writeFile(LOANS_FILE, JSON.stringify(loans, null, 2), "utf-8");
      console.log("Saved staff loan", serverLoan.id);
      res.json({ message: "Loan saved successfully", loan: serverLoan });
    } catch (error) {
      console.error("Failed to save loan:", error);
      res.status(500).json({ error: "Failed to save loan" });
    }
  });

  // PUT /api/staff-loans/:id - Add repayment or update loan
  app.put("/api/staff-loans/:id", async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    try {
      let loans = [];
      try {
        const data = await fs.readFile(LOANS_FILE, "utf-8");
        loans = JSON.parse(data);
      } catch (err) {
        loans = [];
      }
      if (!Array.isArray(loans)) loans = [];
      
      const index = loans.findIndex(l => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Loan not found" });
      }

      if (payload.repayment) {
        if (!loans[index].repayments) loans[index].repayments = [];
        loans[index].repayments.push({
          id: Date.now().toString(),
          ...payload.repayment,
          recordedAt: Date.now()
        });

        const totalRepaid = loans[index].repayments.reduce((sum: number, r: any) => sum + r.paidAmount, 0);
        if (totalRepaid >= loans[index].amount) {
          loans[index].status = 'Paid';
        } else if (totalRepaid > 0) {
          loans[index].status = 'Partially Paid';
        }
      }
      loans[index].updatedAt = Date.now();

      await fs.writeFile(LOANS_FILE, JSON.stringify(loans, null, 2), "utf-8");
      res.json({ message: "Loan updated successfully", loan: loans[index] });
    } catch (error) {
      console.error("Failed to update loan:", error);
      res.status(500).json({ error: "Failed to update loan" });
    }
  });

  // DELETE /api/staff-loans/:id - Delete loan
  app.delete("/api/staff-loans/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let loans = [];
      try {
        const data = await fs.readFile(LOANS_FILE, "utf-8");
        loans = JSON.parse(data);
      } catch (err) {
        loans = [];
      }
      if (!Array.isArray(loans)) loans = [];
      const filtered = loans.filter((l) => l.id !== id);
      await fs.writeFile(LOANS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ message: "Loan deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete loan" });
    }
  });

  // ============================================================================
  // CREDIT PURCHASE ROUTES
  // ============================================================================
  
  // GET /api/credit-purchases - Get all credit purchases
  app.get("/api/credit-purchases", async (req, res) => {
    try {
      let purchases = [];
      try {
        const data = await fs.readFile(CREDITS_FILE, "utf-8");
        purchases = JSON.parse(data);
      } catch (err) {
        purchases = [];
      }
      if (!Array.isArray(purchases)) purchases = [];
      purchases.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      res.json(purchases);
    } catch (error) {
      console.error("Failed to read credit purchases:", error);
      res.status(500).json({ error: "Failed to read credit purchases" });
    }
  });

  // POST /api/credit-purchases - Create new credit purchase
  app.post("/api/credit-purchases", async (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid purchase payload' });
    }

    const serverPurchase = {
      ...payload,
      id: Date.now().toString(),
      createdAt: Date.now(),
      payments: [],
      status: 'Unpaid'
    };

    try {
      let purchases = [];
      try {
        const data = await fs.readFile(CREDITS_FILE, "utf-8");
        purchases = JSON.parse(data);
      } catch (err) {
        purchases = [];
      }
      if (!Array.isArray(purchases)) purchases = [];
      purchases.push(serverPurchase);
      await fs.writeFile(CREDITS_FILE, JSON.stringify(purchases, null, 2), "utf-8");
      console.log("Saved credit purchase", serverPurchase.id);
      res.json({ message: "Purchase saved successfully", purchase: serverPurchase });
    } catch (error) {
      console.error("Failed to save purchase:", error);
      res.status(500).json({ error: "Failed to save purchase" });
    }
  });

  // PUT /api/credit-purchases/:id - Add payment or update purchase
  app.put("/api/credit-purchases/:id", async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    try {
      let purchases = [];
      try {
        const data = await fs.readFile(CREDITS_FILE, "utf-8");
        purchases = JSON.parse(data);
      } catch (err) {
        purchases = [];
      }
      if (!Array.isArray(purchases)) purchases = [];
      
      const index = purchases.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      if (payload.payment) {
        if (!purchases[index].payments) purchases[index].payments = [];
        purchases[index].payments.push({
          id: Date.now().toString(),
          ...payload.payment,
          recordedAt: Date.now()
        });

        const totalPaid = purchases[index].payments.reduce((sum: number, p: any) => sum + p.paidAmount, 0);
        if (totalPaid >= purchases[index].billAmount) {
          purchases[index].status = 'Paid';
        } else if (totalPaid > 0) {
          purchases[index].status = 'Partially Paid';
        }
      }
      purchases[index].updatedAt = Date.now();

      await fs.writeFile(CREDITS_FILE, JSON.stringify(purchases, null, 2), "utf-8");
      res.json({ message: "Purchase updated successfully", purchase: purchases[index] });
    } catch (error) {
      console.error("Failed to update purchase:", error);
      res.status(500).json({ error: "Failed to update purchase" });
    }
  });

  // DELETE /api/credit-purchases/:id - Delete purchase
  app.delete("/api/credit-purchases/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let purchases = [];
      try {
        const data = await fs.readFile(CREDITS_FILE, "utf-8");
        purchases = JSON.parse(data);
      } catch (err) {
        purchases = [];
      }
      if (!Array.isArray(purchases)) purchases = [];
      const filtered = purchases.filter((p) => p.id !== id);
      await fs.writeFile(CREDITS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ message: "Purchase deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete purchase" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
