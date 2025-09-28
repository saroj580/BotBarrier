# Safeguard Of Your Tickets

A full-stack application for secure ticket management, featuring bot detection, payment protection, and real-time analytics.

---

## Project Structure

```
safeguardOfYourTickets/
│
├── backend/        # Node.js/Express REST API server
├── frontend/       # Vite + React + TypeScript web client
├── ml-service/     # Python ML microservice for bot detection
```

---

## Getting Started

### 1. Backend

**Requirements:** Node.js (v18+ recommended), npm

```sh
cd backend
npm install
npm run dev
```

- API endpoints for authentication, payments, admin, bot detection, etc.
- Environment variables: see `.env` and `environment-config.txt`

---

### 2. Frontend

**Requirements:** Node.js, npm

```sh
cd frontend
npm install
npm run dev
```

- Vite + React + TypeScript
- UI components in `src/components/ui/`
- Pages in `src/pages/`
- Configure environment variables in `.env` or `.env.local`

---

### 3. ML Service

**Requirements:** Python 3.12+, pip

```sh
cd ml-service
pip install -r requirements.txt
python ml_service.py
```

- Provides ML scoring for bot detection via API

---

## Features

- **Authentication:** Signup, login, protected routes
- **Payment Protection:** Bot detection, suspicious activity logging
- **Admin Dashboard:** Block management, analytics, real-time metrics
- **ML Integration:** Python microservice for advanced bot scoring
- **Modern UI:** Built with Radix UI, TailwindCSS, and custom components

---

## Environment Variables

- **Backend:** See `backend/.env`
- **Frontend:** See `frontend/.env` and `frontend/.env.local`
- **ML Service:** Configure as needed in `ml-service/`

---

## Scripts

### Backend

- `npm run dev` – Start development server
- `npm test` – Run backend tests

### Frontend

- `npm run dev` – Start frontend dev server
- `npm run build` – Build for production

### ML Service

- `python ml_service.py` – Start ML microservice

---

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/foo`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

MIT

---

## Contact

For questions or support, open an issue or contact the maintainer.