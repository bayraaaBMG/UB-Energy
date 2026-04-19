import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";

const WT = 0.12; // wall thickness

function getRoomConfig(form) {
  const floorColors = { panel: "#b8956a", brick: "#c4a07a", concrete: "#a8a890", wood: "#c8a870" };
  const wallColors  = { panel: "#eae8e4", brick: "#ede5d8", concrete: "#e2e4e6", wood: "#f0ece4" };
  const glassColors = { good: "#a8d8f8", medium: "#b4dcf4", poor: "#c4e4f2" };
  return {
    floorColor: floorColors[form.wall_material] || "#b8956a",
    wallColor:  wallColors[form.wall_material]  || "#eae8e4",
    glassColor: glassColors[form.insulation_quality] || "#b4dcf4",
    hasRadiator: form.heating_type === "central",
    ceilingColor: "#f6f4f0",
  };
}

function RoomShell({ W, D, H, wallColor, floorColor, ceilingColor }) {
  const hw = W / 2, hd = D / 2;
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W, 0.06, D]} />
        <meshLambertMaterial color={floorColor} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, H, 0]}>
        <boxGeometry args={[W, 0.06, D]} />
        <meshLambertMaterial color={ceilingColor} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, H / 2, -hd]}>
        <boxGeometry args={[W, H, WT]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-hw, H / 2, 0]}>
        <boxGeometry args={[WT, H, D]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Right wall */}
      <mesh position={[hw, H / 2, 0]}>
        <boxGeometry args={[WT, H, D]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Front wall — left panel */}
      <mesh position={[-hw / 2 - 0.15, H / 2, hd]}>
        <boxGeometry args={[hw - 0.7, H, WT]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Front wall — right panel */}
      <mesh position={[hw / 2 + 0.15, H / 2, hd]}>
        <boxGeometry args={[hw - 0.7, H, WT]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Front wall — above door */}
      <mesh position={[0, H - 0.3, hd]}>
        <boxGeometry args={[1.0, 0.6, WT]} />
        <meshLambertMaterial color={wallColor} />
      </mesh>
      {/* Floor planks accent lines */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[0, 0.034, -hd + (i + 1) * (D / 6)]}>
          <boxGeometry args={[W, 0.003, 0.006]} />
          <meshLambertMaterial color="#9a7a52" />
        </mesh>
      ))}
    </group>
  );
}

function WindowPanel({ position, glassColor }) {
  return (
    <group position={position}>
      {/* Outer frame */}
      <mesh>
        <boxGeometry args={[1.15, 1.35, WT + 0.02]} />
        <meshLambertMaterial color="#cfc0a8" />
      </mesh>
      {/* Glass pane */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.94, 1.14, 0.03]} />
        <meshLambertMaterial color={glassColor} transparent opacity={0.52} />
      </mesh>
      {/* Horizontal divider */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.94, 0.025, 0.02]} />
        <meshLambertMaterial color="#c0b098" />
      </mesh>
      {/* Vertical divider */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.025, 1.14, 0.02]} />
        <meshLambertMaterial color="#c0b098" />
      </mesh>
      {/* Light through glass */}
      <pointLight position={[0, 0, 0.5]} intensity={0.35} color="#e8f4ff" distance={3} />
    </group>
  );
}

function Radiator({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.85, 0.5, 0.1]} />
        <meshLambertMaterial color="#dedad4" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-0.32 + i * 0.11, 0, 0.06]}>
          <boxGeometry args={[0.025, 0.44, 0.015]} />
          <meshLambertMaterial color="#ccc8c2" />
        </mesh>
      ))}
    </group>
  );
}

function Sofa({ position }) {
  const c1 = "#5a6e8a", c2 = "#4a5e7a";
  return (
    <group position={position}>
      {/* Seat cushions */}
      <mesh position={[-0.6, 0.28, 0]}>
        <boxGeometry args={[0.82, 0.22, 0.72]} />
        <meshLambertMaterial color={c1} />
      </mesh>
      <mesh position={[0.6, 0.28, 0]}>
        <boxGeometry args={[0.82, 0.22, 0.72]} />
        <meshLambertMaterial color={c1} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.62, -0.28]}>
        <boxGeometry args={[1.92, 0.52, 0.16]} />
        <meshLambertMaterial color={c2} />
      </mesh>
      {/* Armrests */}
      <mesh position={[-0.93, 0.46, 0]}>
        <boxGeometry args={[0.1, 0.46, 0.72]} />
        <meshLambertMaterial color={c2} />
      </mesh>
      <mesh position={[0.93, 0.46, 0]}>
        <boxGeometry args={[0.1, 0.46, 0.72]} />
        <meshLambertMaterial color={c2} />
      </mesh>
      {/* Legs */}
      {[[-0.82, -0.28], [0.82, -0.28], [-0.82, 0.28], [0.82, 0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]}>
          <boxGeometry args={[0.07, 0.1, 0.07]} />
          <meshLambertMaterial color="#2a1a0a" />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.85, 0.04, 0.48]} />
        <meshLambertMaterial color="#8b6a40" />
      </mesh>
      {[[-0.35, -0.19], [0.35, -0.19], [-0.35, 0.19], [0.35, 0.19]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.15, z]}>
          <boxGeometry args={[0.045, 0.3, 0.045]} />
          <meshLambertMaterial color="#7a5a30" />
        </mesh>
      ))}
      {/* Book on table */}
      <mesh position={[0.2, 0.335, 0.1]}>
        <boxGeometry args={[0.22, 0.03, 0.16]} />
        <meshLambertMaterial color="#c44030" />
      </mesh>
      {/* Cup */}
      <mesh position={[-0.22, 0.36, -0.08]}>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 10]} />
        <meshLambertMaterial color="#f0ece4" />
      </mesh>
    </group>
  );
}

function TVUnit({ position }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* Cabinet */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[1.25, 0.42, 0.38]} />
        <meshLambertMaterial color="#2c2824" />
      </mesh>
      {/* TV bezel */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[1.18, 0.67, 0.06]} />
        <meshLambertMaterial color="#1a1614" />
      </mesh>
      {/* TV screen — glowing blue */}
      <mesh position={[0, 0.82, 0.035]}>
        <boxGeometry args={[1.06, 0.56, 0.01]} />
        <meshLambertMaterial color="#0e2a4a" emissive="#0a2244" emissiveIntensity={0.7} />
      </mesh>
      {/* Screen light */}
      <pointLight position={[0, 0.82, 0.6]} intensity={0.3} color="#4488cc" distance={2.5} />
      {/* TV stand foot */}
      <mesh position={[0, 0.49, 0]}>
        <boxGeometry args={[0.12, 0.06, 0.25]} />
        <meshLambertMaterial color="#1a1614" />
      </mesh>
    </group>
  );
}

function Rug({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 1.55]} />
        <meshLambertMaterial color="#7a4830" />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.96, 1.3]} />
        <meshLambertMaterial color="#8c5838" />
      </mesh>
    </group>
  );
}

function Door({ position }) {
  return (
    <group position={position}>
      {/* Door slab */}
      <mesh>
        <boxGeometry args={[0.92, 1.98, 0.055]} />
        <meshLambertMaterial color="#c8a46a" />
      </mesh>
      {/* Door panels */}
      <mesh position={[0, 0.38, 0.032]}>
        <boxGeometry args={[0.72, 0.72, 0.02]} />
        <meshLambertMaterial color="#b89050" />
      </mesh>
      <mesh position={[0, -0.38, 0.032]}>
        <boxGeometry args={[0.72, 0.72, 0.02]} />
        <meshLambertMaterial color="#b89050" />
      </mesh>
      {/* Handle */}
      <mesh position={[0.34, 0.05, 0.06]}>
        <cylinderGeometry args={[0.025, 0.025, 0.13, 8]} rotation={[Math.PI / 2, 0, 0]} />
        <meshLambertMaterial color="#c8a020" />
      </mesh>
    </group>
  );
}

function DiningTable({ position }) {
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[1.1, 0.05, 0.7]} />
        <meshLambertMaterial color="#8a6040" />
      </mesh>
      {/* Legs */}
      {[[-0.46, -0.28], [0.46, -0.28], [-0.46, 0.28], [0.46, 0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]}>
          <boxGeometry args={[0.045, 0.44, 0.045]} />
          <meshLambertMaterial color="#7a5030" />
        </mesh>
      ))}
    </group>
  );
}

function Chair({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.44, 0.04, 0.44]} />
        <meshLambertMaterial color="#a07848" />
      </mesh>
      <mesh position={[0, 0.6, -0.2]}>
        <boxGeometry args={[0.44, 0.62, 0.04]} />
        <meshLambertMaterial color="#907040" />
      </mesh>
      {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.13, z]}>
          <boxGeometry args={[0.04, 0.26, 0.04]} />
          <meshLambertMaterial color="#7a5030" />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.28, 8]} />
        <meshLambertMaterial color="#a05820" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.24, 10, 10]} />
        <meshLambertMaterial color="#2a7a2e" />
      </mesh>
      <mesh position={[0.1, 0.52, 0.1]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshLambertMaterial color="#347a38" />
      </mesh>
    </group>
  );
}

function CeilingLamp({ position }) {
  return (
    <group position={position}>
      {/* Cord */}
      <mesh>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        <meshLambertMaterial color="#444" />
      </mesh>
      {/* Shade */}
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.22, 0.12, 0.14, 12]} />
        <meshLambertMaterial color="#e8dcc8" />
      </mesh>
      {/* Bulb glow */}
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshLambertMaterial color="#fffadc" emissive="#fffadc" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }) {
  return (
    <group position={position}>
      {/* Frame */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.78, 1.44, 0.28]} />
        <meshLambertMaterial color="#5a3a20" />
      </mesh>
      {/* Shelves */}
      {[0.24, 0.6, 0.96].map((y, i) => (
        <mesh key={i} position={[0, y, 0.02]}>
          <boxGeometry args={[0.68, 0.03, 0.22]} />
          <meshLambertMaterial color="#4a2a18" />
        </mesh>
      ))}
      {/* Books */}
      {[[-0.22, 0.38], [0.0, 0.38], [0.16, 0.38],
        [-0.24, 0.74], [-0.06, 0.74], [0.14, 0.74],
        [-0.2, 1.1], [0.04, 1.1]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.04]}>
          <boxGeometry args={[0.1, 0.22, 0.16]} />
          <meshLambertMaterial color={["#c44030","#2a6a9a","#a87030","#3a8a6a","#8a4a8a","#1a5a8a","#c87020","#4a8a3a"][i]} />
        </mesh>
      ))}
    </group>
  );
}

function InteriorScene({ form }) {
  const cfg = getRoomConfig(form);
  const W = 5.6, D = 4.6, H = 2.65;
  const hw = W / 2, hd = D / 2;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.48} color="#fff6e8" />
      <pointLight position={[0, H - 0.25, 0]} intensity={1.6} color="#fffaec" castShadow />
      <pointLight position={[hw - 0.6, H * 0.55, -hd + 1.0]} intensity={0.5} color="#e4f0ff" />
      <pointLight position={[-hw + 0.6, H * 0.55, hd - 1.0]} intensity={0.35} color="#fff4e0" />

      {/* Room shell */}
      <RoomShell W={W} D={D} H={H}
        wallColor={cfg.wallColor} floorColor={cfg.floorColor} ceilingColor={cfg.ceilingColor} />

      {/* Ceiling lamp */}
      <CeilingLamp position={[0, H - 0.01, -0.4]} />

      {/* Windows on back wall */}
      <WindowPanel position={[-1.3, H * 0.55, -hd + WT / 2]} glassColor={cfg.glassColor} />
      <WindowPanel position={[1.3, H * 0.55, -hd + WT / 2]} glassColor={cfg.glassColor} />

      {/* Radiators under windows */}
      {cfg.hasRadiator && <>
        <Radiator position={[-1.3, 0.3, -hd + 0.14]} />
        <Radiator position={[1.3, 0.3, -hd + 0.14]} />
      </>}

      {/* Door in front wall */}
      <Door position={[0, 1.0, hd - WT / 2]} />

      {/* Living area */}
      <Sofa position={[0.1, 0, -hd + 1.25]} />
      <CoffeeTable position={[0.1, 0, -hd + 2.45]} />
      <Rug position={[0.1, 0.032, -hd + 1.95]} />
      <TVUnit position={[hw - WT / 2, 0, -0.6]} />

      {/* Plants */}
      <Plant position={[hw - 0.42, 0, -hd + 0.5]} />
      <Plant position={[-hw + 0.42, 0, hd - 0.5]} />

      {/* Dining area */}
      <DiningTable position={[-hw + 1.5, 0, hd - 1.3]} />
      <Chair position={[-hw + 0.8, 0, hd - 1.3]} rotation={[0, Math.PI / 2, 0]} />
      <Chair position={[-hw + 2.2, 0, hd - 1.3]} rotation={[0, -Math.PI / 2, 0]} />
      <Chair position={[-hw + 1.5, 0, hd - 0.8]} rotation={[0, Math.PI, 0]} />

      {/* Bookshelf on left wall */}
      <Bookshelf position={[-hw + 0.17, 0, -0.5]} />
    </>
  );
}

export default function Building3DInterior({ form }) {
  return (
    <div style={{ width: "100%", height: "340px", borderRadius: "12px", overflow: "hidden", background: "linear-gradient(140deg, #161b28 0%, #1e2438 100%)" }}>
      <Canvas
        shadows
        camera={{ position: [3.8, 2.0, 3.8], fov: 58 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <InteriorScene form={form} />
          <OrbitControls
            target={[0, 1.1, 0]}
            minDistance={1.2}
            maxDistance={7.5}
            maxPolarAngle={Math.PI * 0.84}
            minPolarAngle={0.08}
            enablePan={false}
            makeDefault
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
