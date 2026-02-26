# Onboarding System Design Wireframe

This is an interactive prototype for the **bicec-veripass** mobile onboarding experience. It is built using **React**, **Tailwind CSS**, and **Framer Motion** to simulate the premium, "Revolut-styled" UX described in the design specifications.

## 🚀 Purpose
- **Validation**: Test the flow from Splash screen to Dashboard.
- **Visual Design**: Demonstrate the Glassmorphism aesthetic and Skeuomorphic interactions.
- **Development Reference**: Serve as a high-fidelity guide for the Flutter implementation.

## 🛠️ Tech Stack
- **React 19**: UI Framework.
- **Vite**: Ultra-fast build tool and development server.
- **Tailwind CSS 4**: Utility-first styling with the new Vite plugin.
- **Framer Motion**: For smooth transitions and "celebration" animations.
- **Lucide React**: For consistent, high-contrast iconography.

## 🏃 Getting Started

1. **Navigate to the directory**:
   ```bash
   cd docs/test_tmp_trash/onboarding-system-design-wireframe
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Build for production** (generates a single-file bundle):
   ```bash
   npm run build
   ```

## 📂 Key Components (in `src/`)
- `/components`: Reusable UI elements (Buttons, Glass Cards, Steppers).
- `/screens`: Implementation of specific steps (A01-E06) such as CNI Capture, Liveness, and Plans Discovery.
- `App.tsx`: The main navigation controller and state machine for the onboarding flow.

---
**Note**: This is a trash/temp folder used for wireframing and does not contain the final Flutter production code.
