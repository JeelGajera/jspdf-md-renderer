import { pdfGenerator } from './pdfGenerator';
import './style.css';
import typescriptLogo from '/typescript.svg';
import viteLogo from '/vite.svg';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript + jsPDF + jspdf-md-renderer</h1>
    <div class="card">
      <button id="pdfGenBtn" type="button">Generate PDF!</button>
    </div>
  </div>
`;

document.querySelector<HTMLButtonElement>('#pdfGenBtn')?.addEventListener('click', () => pdfGenerator());
