# Cloud-Based Personal Storage

A full-stack personal cloud storage system built on AWS, with automated media processing, a searchable WhatsApp archive, and a React frontend. Built as a portfolio project to demonstrate end-to-end cloud engineering.

**Live demo:** http://cloud-personal-storage-website-dev.s3-website-us-east-1.amazonaws.com
**Demo credentials:** `demo@example.com` / `Demo2024!`

---

## Features

- **Photos** — Upload JPEGs, PNGs, or WebPs. A Lambda function generates thumbnails using Pillow and stores metadata (filename, upload date, tags) in DynamoDB. Browse a responsive grid with one-click downloads.
- **Videos** — Upload MP4, MOV, AVI, MKV, or WebM files. A Lambda function extracts a thumbnail frame and duration using FFmpeg, then stores metadata in DynamoDB. Browse videos grouped by upload date.
- **WhatsApp Archive** — Upload a WhatsApp `.txt` export. A Lambda parses each message and stores sender, date, time, and body in DynamoDB. Search by sender, date, or keyword via a REST API.
- **Other Files** — ZIP archives and miscellaneous files stored as-is in S3, browsable from the UI.
- **Storage Tiers** — Choose Standard, Standard-IA, or Glacier Instant Retrieval per upload. Applied to the original file; thumbnails always stay in Standard.
- **Dark Mode** — Full light/dark theme toggle, persisted to localStorage.
- **Demo Mode** — A read-only Cognito user (`demo@example.com`) is provisioned by Terraform so visitors can browse without creating an account.

---

## Architecture

```
Browser (React + AWS Amplify)
    │
    ├─── S3 (static website hosting)
    │
    ├─── Cognito (authentication)
    │
    ├─── S3 (media storage)  ──── S3 Event ──► photo_processor Lambda  (Pillow thumbnails)
    │                                     ──► video_processor Lambda  (FFmpeg thumbnails)
    │                                     ──► whatsapp_bronze Lambda  (message parser)
    │
    └─── API Gateway (Cognito authorizer)
             ├─ /photos    → photos_api Lambda   → DynamoDB PhotoMetadata
             ├─ /videos    → videos_api Lambda   → DynamoDB VideoMetadata
             └─ /chats     → whatsapp_api Lambda → DynamoDB WhatsAppMessages
```

**Infrastructure is fully managed by Terraform** (no ClickOps). The frontend is bootstrapped with AWS Amplify CLI for Auth/Storage, then Terraform manages everything else.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, AWS Amplify JS v6, React Router v6 |
| Auth | Amazon Cognito (User Pool + Identity Pool) |
| Storage | Amazon S3 (multi-tier: Standard / Standard-IA / Glacier IR) |
| Compute | AWS Lambda (Python 3.12) |
| Database | Amazon DynamoDB |
| API | Amazon API Gateway (REST, Cognito JWT authorizer) |
| Analytics | AWS Glue + Amazon Athena (metadata catalog) |
| IaC | Terraform 1.10+ |
| Media processing | Pillow (photo thumbnails), FFmpeg (video thumbnails) |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
.
├── frontend/               # React app (Create React App)
│   ├── amplify/            # Amplify CLI config (Auth + Storage)
│   └── src/
│       ├── components/     # Nav
│       ├── pages/          # LibraryPage, PhotosPage, VideosPage, WhatsAppPage, OtherFilesPage
│       ├── ThemeContext.js  # Light/dark theme provider
│       └── App.js
│
└── terraform/
    ├── main.tf              # Root module — wires everything together
    ├── modules/
    │   ├── storage/         # DynamoDB tables + S3 website bucket
    │   ├── compute/         # API Gateway, Lambda functions, IAM roles
    │   └── analytics/       # Glue database + Athena workgroup
    └── lambdas/
        ├── photo_processor/ # Pillow thumbnail generation
        ├── video_processor/ # FFmpeg thumbnail + duration extraction
        ├── photos_api/      # GET /photos — list with pre-signed URLs
        ├── videos_api/      # GET /videos — list with pre-signed URLs
        ├── whatsapp_api/    # GET /chats  — filter by date/sender/search
        └── whatsapp_bronze/ # Parse WhatsApp .txt exports → DynamoDB
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- AWS CLI configured with a profile that has S3/Cognito/API Gateway access
- Amplify CLI (`npm install -g @aws-amplify/cli`)

### Frontend

```bash
cd frontend
npm install
# Copy and fill in your API URLs
cp .env.example .env
npm start
```

The `.env` file needs:
```
REACT_APP_PHOTOS_API_URL=https://<your-api>.execute-api.us-east-1.amazonaws.com/dev/photos
REACT_APP_VIDEOS_API_URL=https://<your-api>.execute-api.us-east-1.amazonaws.com/dev/videos
REACT_APP_CHATS_API_URL=https://<your-api>.execute-api.us-east-1.amazonaws.com/dev/chats
```

### Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Terraform outputs the API URLs so you can paste them into `.env`.

---

## CI/CD

GitHub Actions runs on every push to `main`. The workflow builds the React app and syncs it to the S3 website bucket.

See `.github/workflows/` for details.
