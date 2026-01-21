# Scene-On [Incomplete][WIP]
Scene-On is a location-based social app where you can anonymously interact with people near you using temporary personas.

Think of it as a way to:
* Choose different personas (like wearing different masks) to express yourself anonymously
* See who's nearby on a map based on your location
* Broadcast short "yells" (32-character messages) that everyone in your area can see for 5 minutes
* Have ephemeral/temporary chats with nearby people that disappear after a while
* Discover local scenes and switch between different community spaces
* It's designed for spontaneous, temporary connections with people around you - nothing is permanent, and you control your identity through different personas. Perfect for expressing yourself freely in the moment without long-term digital footprints.


---

## Live & Managed Services

- **Database (Neon – Managed)**  
  https://console.neon.tech/app/projects/snowy-fire-15936277?database=scene-on

- **Frontend (Vercel)**  
  https://vercel.com/lubdhaks-projects-91deb0ea

- **Backend (Render)**  
  https://dashboard.render.com/web/srv-d5jv8pvfte5s738umss0

---



~~~bash
# Dev
cd Codebase/scene-on/backend && make dev
cd Codebase/scene-on/frontend && make dev
cd Codebase/scene-on/database && db-drop && db-create
~~~


~~~bash
# backend/dev.env
PORT=8080
DATABASE_URL=postgres://scene_user:scene_pass@localhost:5432/scene_on
GIN_MODE=debug
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=24h
FRONTEND_URL=http://localhost:4200
GOOGLE_CLIENT_ID=XXX
GOOGLE_CLIENT_SECRET=XXX
GOOGLE_REDIRECT_URL=http://localhost:8080/api/v1/auth/google/callback

# frontend/dev.env
VITE_API_URL=http://localhost:8080
VITE_MAPBOX_TOKEN=your_actual_mapbox_token_here

# database/dev.env
DB_NAME=scene_on
DB_USER=scene_user
DB_PASSWORD=scene_pass
DB_HOST=localhost
DB_PORT=5432
~~~