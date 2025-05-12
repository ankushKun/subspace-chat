
function App() {
  return (
    <div className="min-h-screen bg-[#181818] flex items-center justify-center font-mono">
      <div className="bg-[#1f1f1f] rounded-lg shadow-lg w-full max-w-5xl mx-4 p-12 flex flex-col items-center justify-center" style={{ minHeight: '70vh' }}>
        <h1 className="text-6xl md:text-8xl font-bold mb-6 flex items-center space-x-2 select-none">
          <span className="text-[#444] font-normal" style={{ WebkitTextStroke: '1px #fff', color: 'transparent' }}>SUB</span>
          <span className="text-white font-bold">SPACE</span>
        </h1>
        <p className="text-[#ccc] text-lg mb-12 tracking-wide text-center">Your intergalactic communications system</p>
        <button className="mt-4 px-10 py-3 border border-[#ccc] text-[#ccc] rounded-none bg-transparent text-lg tracking-widest hover:bg-[#222] transition-colors duration-200">
          LOGIN
        </button>
      </div>
    </div>
  );
}

export default App;
