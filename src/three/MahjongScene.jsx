import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';

const TILE_COUNT = 13;

function Tile({ position, rotation = [0, 0, 0], selected = false }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.38, 0.12, 0.56]} />
        <meshStandardMaterial roughness={0.7} metalness={0.05} color={selected ? '#f5db78' : '#f7edd5'} />
      </mesh>
      <mesh position={[0, 0.066, 0.01]}>
        <boxGeometry args={[0.28, 0.01, 0.38]} />
        <meshStandardMaterial roughness={0.85} color={selected ? '#fff4a8' : '#fffaf0'} />
      </mesh>
    </group>
  );
}

function TileWall({ side = 'bottom' }) {
  const tiles = Array.from({ length: TILE_COUNT }, (_, index) => index);
  const isVertical = side === 'left' || side === 'right';
  const baseZ = side === 'top' ? -1.65 : side === 'bottom' ? 1.65 : 0;
  const baseX = side === 'right' ? 2.35 : side === 'left' ? -2.35 : 0;

  return (
    <group>
      {tiles.map((index) => {
        const offset = (index - (TILE_COUNT - 1) / 2) * 0.32;
        const position = isVertical ? [baseX, 0.08, offset] : [offset, 0.08, baseZ];
        const rotation = isVertical ? [0, Math.PI / 2, 0] : [0, 0, 0];
        return <Tile key={`${side}-${index}`} position={position} rotation={rotation} />;
      })}
    </group>
  );
}

function MahjongPlaceholderTable() {
  return (
    <group rotation={[0, 0, 0]}>
      <mesh receiveShadow position={[0, -0.08, 0]}>
        <boxGeometry args={[5.8, 0.16, 3.9]} />
        <meshStandardMaterial color="#102f1f" roughness={0.92} />
      </mesh>

      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[5.28, 0.08, 3.38]} />
        <meshStandardMaterial color="#146235" roughness={0.96} />
      </mesh>

      <TileWall side="top" />
      <TileWall side="bottom" />
      <TileWall side="right" />

      <group position={[-0.5, 0.1, 0.15]}>
        {[-0.42, 0, 0.42].map((x, index) => (
          <Tile key={x} position={[x, 0, index === 1 ? -0.03 : 0]} selected={index === 1} />
        ))}
      </group>

      <group position={[0, 0.1, 0.9]}>
        {[-0.64, -0.32, 0, 0.32, 0.64].map((x) => (
          <Tile key={x} position={[x, 0, 0]} />
        ))}
      </group>
    </group>
  );
}

export default function MahjongScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 4.6, 4.8], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2.8, 4.8, 3.4]} intensity={1.45} castShadow />
      <MahjongPlaceholderTable />
      <ContactShadows position={[0, -0.17, 0]} opacity={0.32} scale={6} blur={2.6} far={2.8} />
      <Environment preset="night" />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  );
}
