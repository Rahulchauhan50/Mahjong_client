import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function TableScene() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 5, 3]} intensity={1.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.2, 64]} />
        <meshStandardMaterial />
      </mesh>
      {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((x, index) => (
        <mesh key={x} position={[x, 0.08, 0.7]}>
          <boxGeometry args={[0.28, 0.12, 0.42]} />
          <meshStandardMaterial />
        </mesh>
      ))}
    </>
  );
}

export default function MahjongTablePreview() {
  return (
    <Canvas camera={{ position: [0, 3, 4], fov: 45 }}>
      <TableScene />
      <OrbitControls enablePan={false} enableZoom={false} />
    </Canvas>
  );
}
