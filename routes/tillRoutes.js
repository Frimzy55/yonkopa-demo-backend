// routes/tillRoutes.js
import express from 'express';
import { db } from '../config/db.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();


// POST /api/tills/create
router.post(
  '/',
  [
    body('tillName').notEmpty().withMessage('Till name is required'),
    body('branch').notEmpty().withMessage('Branch is required'),
    body('currency').notEmpty().withMessage('Currency is required'),
    body('tillType').notEmpty().withMessage('Till type is required'),
    body('assignedTeller').notEmpty().withMessage('Assigned teller is required'),
    body('supervisor').notEmpty().withMessage('Supervisor is required'),
    body('effectiveDate').isISO8601().withMessage('Valid date required'),
    body('openingBalance').optional().isNumeric(),
    body('maxBalance').optional().isNumeric(),
    body('cashLimitPerTransaction').optional().isNumeric(),
    body('dailyCashLimit').optional().isNumeric(),
    body('overLimitAction').optional().isIn(['block', 'approval', 'alert']),
  ],

  (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }


    const {
      tillName,
      branch,
      currency,
      tillType,
      openingBalance = 0,
      maxBalance = 0,
      cashLimitPerTransaction = 0,
      dailyCashLimit = 0,
      overLimitAction = 'block',
      assignedTeller,
      supervisor,
      effectiveDate
    } = req.body;



    db.getConnection((err, connection) => {

      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'Database connection failed'
        });
      }


      // Generate next Till number
      connection.query(
        `SELECT till_number 
         FROM tills 
         ORDER BY id DESC 
         LIMIT 1`,

        (err, rows) => {

          if (err) {
            connection.release();

            return res.status(500).json({
              error: 'Failed to generate till number'
            });
          }


          let nextNumber = 10001;


          if (rows.length > 0) {

            const match = rows[0].till_number.match(/Till-(\d+)/);


            if (match) {

              const num = parseInt(match[1], 10);

              if (!isNaN(num)) {
                nextNumber = num + 1;
              }

            }
          }


          const tillNumber = `Till-${nextNumber}`;



          const insertSql = `
            INSERT INTO tills (
              till_number,
              till_name,
              branch,
              currency,
              till_type,
              opening_balance,
              max_balance,
              cash_limit_per_transaction,
              daily_cash_limit,
              over_limit_action,
              assigned_teller,
              supervisor,
              effective_date,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;



          connection.query(
            insertSql,

            [
              tillNumber,
              tillName,
              branch,
              currency,
              tillType,
              openingBalance,
              maxBalance,
              cashLimitPerTransaction,
              dailyCashLimit,
              overLimitAction,
              assignedTeller,
              supervisor,
              effectiveDate,
              'active'
            ],


            (err, result) => {

              if (err) {

                connection.release();


                if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({
                    error: 'Till number already exists'
                  });
                }


                return res.status(500).json({
                  error: 'Failed to create till'
                });

              }



              // Get created till
              connection.query(

                `SELECT * FROM tills WHERE id = ?`,

                [result.insertId],


                (err, newTill) => {

                  connection.release();


                  if (err) {
                    return res.status(500).json({
                      error: 'Failed to fetch created till'
                    });
                  }



                  res.status(201).json({

                    message: 'Till created successfully',

                    till: newTill[0]

                  });

                }

              );


            }

          );


        }

      );


    });

  }

);





// ------------------------------
router.get('/', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    connection.query(
      `SELECT * FROM tills ORDER BY id DESC`,
      (err, rows) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to fetch tills' });
        }
        res.json(rows);
      }
    );
  });
});

// ------------------------------
// GET /api/tills/:id  - Fetch a single till by ID
// ------------------------------
router.get('/:id', (req, res) => {
  const tillId = req.params.id;

  // Validate that id is a number
  if (isNaN(tillId)) {
    return res.status(400).json({ error: 'Invalid till ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    connection.query(
      `SELECT * FROM tills WHERE id = ?`,
      [tillId],
      (err, rows) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to fetch till' });
        }
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Till not found' });
        }
        res.json(rows[0]);
      }
    );
  });
});



export default router;