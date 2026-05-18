import express from 'express';
import { db } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Assign tasks to a user (overwrites old tasks)
router.post("/assign-tasks", (req, res) => {
  const { userId, staff_name, tasks } = req.body;
  if (!userId || !tasks || !Array.isArray(tasks)) return res.status(400).json({ message: "Invalid request data" });
  const deleteSql = "DELETE FROM tasks WHERE userId = ?";
  db.query(deleteSql, [userId], (deleteErr) => {
    if (deleteErr) return res.status(500).json({ message: "Failed to clear old tasks" });
    if (tasks.length === 0) return res.json({ message: "Tasks cleared successfully" });
    const values = tasks.map(task => [userId, staff_name, task]);
    const insertSql = `INSERT INTO tasks (userId, staff_name, task_name) VALUES ?`;
    db.query(insertSql, [values], (err) => {
      if (err) return res.status(500).json({ message: "Failed to assign tasks" });
      res.json({ message: "Tasks assigned successfully" });
    });
  });
});

// Get user tasks
router.get("/api/user-tasks/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT task_name FROM tasks WHERE userId = ? ORDER BY created_at DESC`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    const tasks = results.map(row => row.task_name);
    res.json({ tasks });
  });
});

// Alternative endpoint for tasks
router.get("/tasks2/:userId", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT task_name FROM tasks WHERE userId = ?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
});

// Remove a single task from a user
router.delete("/remove-task", (req, res) => {
  const { userId, task } = req.body;
  if (!userId || !task) return res.status(400).json({ message: "userId and task are required" });
  const sql = `DELETE FROM tasks WHERE userId = ? AND task_name = ?`;
  db.query(sql, [userId, task], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Task not found for this user" });
    res.status(200).json({ message: "Permission removed successfully" });
  });
});

export default router;