/* HFO Explainer — App composer.
   Pulls components from window (loaded by sections.jsx and simulator.jsx) */

function App() {
  return (
    <div className="app">
      <window.Hero />
      <window.WaveformCompare />
      <window.Metaphor />
      <window.PistonVsJet />
      <window.Indications />
      <window.Simulator />
      <window.FlowSensor />
      <window.ProtocolSteps />
      <window.Hemodynamics />
      <window.BloodGasReminder />
      <window.HowToStart />
      <window.AdjustmentMatrix />
      <window.Mistakes />
      <window.DeviceAnatomy />
      <window.CheatSheet />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
