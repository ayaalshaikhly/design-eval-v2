# Design Evaluation Suite — Version 2

A peer-evaluation tool for design studio education, built for the School of Industrial Design at Carleton University.

Developed by **Aya Al-Shaikhly**, based on evaluation frameworks by **Prof. WonJoon Chung**
School of Industrial Design, Carleton University — Fall 2026

## Tools

- **Metaphoric Design Evaluation** — Metaphorical Abstraction (Highly Literal → Highly Abstract) and Source Relevance (Irrelevant → Highly Relevant), up to 3 ideas per presenter.
- **MAYA Calibration** — Familiarity (Hard to understand → Instantly understood) and Novelty (Very familiar → Never seen before), plotted against the MAYA zone (Most Advanced Yet Acceptable).

Every point of every 1–5 scale is described on screen when the student taps it.

## How a class session works

1. **Instructor** creates a session: picks the tool, uploads the class list (Excel/CSV, e.g. the Brightspace class list) or adds names one by one, and sets the target zone's position and size.
2. **Students** scan one QR code once, tap the presenter's name, rate, and press Submit, which returns them to the name list.
3. **Results** appear live on the instructor's board: each presenter's map with a suggested direction, and a class map of all ideas (names on or off).
4. Results can be downloaded as CSV. Ratings are anonymous.

## Tech stack

- Frontend: vanilla HTML, CSS, JavaScript (SheetJS reads the class list in the browser)
- Backend: Vercel Serverless Functions (Node.js)
- Database: Neon (PostgreSQL)

## Project structure

```
├── public/
│   ├── index.html        # Landing page — choose a tool
│   ├── class.html        # Instructor: create sessions, class board, class map, zone, class list
│   ├── go.html           # Student: name list → rating → back to list
│   ├── tools.js          # Scale definitions, zone suggestions, map drawing
│   ├── style.css
│   ├── qrcode.min.js
│   └── xlsx.full.min.js  # SheetJS
├── api/
│   ├── class.js          # All session actions (get, rate, results, create, update, delete, list)
│   └── setup-db.js       # Creates the database tables
└── vercel.json
```

## Setup

| Environment variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `INSTRUCTOR_PASSCODE` | Instructor passcode (kept only in Vercel, never in the code) |

After the first deploy, open `/api/setup-db` once to create the tables.

## License

Private — Carleton University
