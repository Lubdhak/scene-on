# Scene Weaver

A React-based web application built with Vite, TypeScript, and modern UI components.

## 🚀 Tech Stack

- **Frontend Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.19
- **Language**: TypeScript 5.8.3
- **UI Components**: shadcn-ui with Radix UI primitives
- **Styling**: Tailwind CSS 3.4.17
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack React Query 5.83.0
- **Animations**: Framer Motion 12.23.26
- **Maps**: Mapbox GL 3.17.0
- **Form Handling**: React Hook Form 7.61.1 with Zod validation
- **Theme**: next-themes for dark mode support

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher recommended)
- **npm** or **bun** (package manager)
- **make** (optional, for using Makefile commands)

> **Note**: This project supports both npm and bun. The lockfiles for both are included.

## ⚡ Quick Start with Makefile

This project includes a Makefile for convenient command execution. To see all available commands:

```bash
make help
```

### Common Make Commands

```bash
make install      # Install dependencies
make dev          # Start development server
make build        # Build for production
make lint         # Run ESLint
make clean        # Clean build artifacts
```

For bun users:
```bash
make install-bun  # Install with bun
make dev-bun      # Run dev server with bun
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scene-weaver
   ```

2. **Install dependencies**
   
   Using npm:
   ```bash
   npm install
   ```
   
   Or using bun:
   ```bash
   bun install
   ```

## 🏃 Running the Application

### Development Mode

Start the development server with hot module replacement:

Using npm:
```bash
npm run dev
```

Or using bun:
```bash
bun run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Production Build

Build the application for production:

```bash
npm run build
```

This will create an optimized production build in the `dist` directory.

### Development Build

Build the application in development mode:

```bash
npm run build:dev
```

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## 🧪 Code Quality

### Linting

Run ESLint to check for code quality issues:

```bash
npm run lint
```

## 📁 Project Structure

```
scene-weaver/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and libraries
│   ├── pages/           # Page components
│   │   ├── Index.tsx
│   │   ├── PersonaSelect.tsx
│   │   ├── MapView.tsx
│   │   └── NotFound.tsx
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Project dependencies
├── vite.config.ts       # Vite configuration
├── tailwind.config.ts   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## 🗺️ Application Routes

- `/` - Home page (Index)
- `/persona` - Persona selection page
- `/map` - Map view page
- `*` - 404 Not Found page

## 🎨 UI Components

This project uses [shadcn-ui](https://ui.shadcn.com/) components, which are built on top of Radix UI primitives and styled with Tailwind CSS. Components include:

- Accordion, Alert Dialog, Avatar
- Buttons, Cards, Checkboxes
- Dialogs, Dropdowns, Forms
- Navigation, Menus, Modals
- Tabs, Tooltips, Toast notifications
- And many more...

## 🔧 Configuration Files

- **vite.config.ts** - Vite build configuration
- **tailwind.config.ts** - Tailwind CSS customization
- **tsconfig.json** - TypeScript compiler options
- **eslint.config.js** - ESLint rules
- **postcss.config.js** - PostCSS configuration
- **components.json** - shadcn-ui components configuration

## 🌍 Environment Variables

If your application requires environment variables (e.g., for Mapbox API keys), create a `.env` file in the root directory:

```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

> **Note**: Environment variables must be prefixed with `VITE_` to be accessible in the application.

## 📦 Key Dependencies

### UI & Styling
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework
- `framer-motion` - Animation library
- `lucide-react` - Icon library

### Routing & State
- `react-router-dom` - Client-side routing
- `@tanstack/react-query` - Server state management

### Forms & Validation
- `react-hook-form` - Form handling
- `zod` - Schema validation

### Maps
- `mapbox-gl` - Interactive maps

## 🐛 Troubleshooting

### Port already in use
If port 5173 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Module not found errors
Try deleting `node_modules` and reinstalling:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build errors
Ensure you're using a compatible Node.js version (v16+):
```bash
node --version
```

## 📄 License

This project is private and not licensed for public use.

## 🤝 Contributing

This is a private project. Please contact the repository owner for contribution guidelines.
ls