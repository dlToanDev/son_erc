const fs = require('fs');
const path = 'apps/web/src/styles/global.css';
let code = fs.readFileSync(path, 'utf8');

// Find where my previous additions started, or just clean up all @media tags
// Since it's safer, I will just append to the end, but the prompt says to refactor the whole file.
// I will write a very clean block of CSS and append it, ensuring it uses strong specificity or just clean up the end of the file.
// Let's truncate everything after line 965 (where I saw "/* ---- Responsive Enhancements (PC, Laptop, Tablet, Mobile) ---- */")
const splitPoint = "/* ---- Responsive Enhancements (PC, Laptop, Tablet, Mobile) ---- */";
if (code.indexOf(splitPoint) > -1) {
  code = code.substring(0, code.indexOf(splitPoint));
}

const mobileCSS = `
/* ==========================================================================
   📱 MOBILE-FIRST RESPONSIVE DESIGN (≤ 868px)
   ========================================================================== */

/* ---- SKELETON LOADER ---- */
.skeleton {
  background: #e2e8f0;
  background-image: linear-gradient(90deg, #e2e8f0 0px, #f1f5f9 40px, #e2e8f0 80px);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite linear;
  border-radius: 4px;
}
@keyframes loading-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Base styles for mobile-header, etc. so they can be hidden on desktop */
.mobile-header { display: none; }
.mobile-overlay { display: none; }
.mobile-card-list { display: none; }

@media (max-width: 868px) {
  /* 1. LAYOUT / SIDEBAR */
  .app-shell {
    display: block;
    height: auto;
    overflow: visible;
  }
  
  .mobile-header {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 56px;
    z-index: 999;
    background: var(--df-primary-dark);
    padding: 0 1rem;
    align-items: center;
    justify-content: space-between;
  }
  
  .app-main {
    padding-top: 64px !important;
    padding-bottom: 2rem !important;
    min-height: 100vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overflow-x: hidden;
  }
  
  .sidebar {
    position: fixed;
    top: 56px;
    left: 0;
    width: 280px;
    height: calc(100vh - 56px);
    z-index: 1000;
    overflow-y: auto;
    background: var(--df-primary-dark);
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: none;
  }
  
  .sidebar.mobile-open {
    transform: translateX(0);
    box-shadow: 4px 0 15px rgba(0,0,0,0.5);
  }
  
  .mobile-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.6);
    z-index: 998;
    backdrop-filter: blur(2px);
  }
  
  .nav-link {
    min-height: 48px;
  }

  /* 3. DASHBOARD & TYPOGRAPHY */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .page-header h1, .page-header h2 {
    font-size: 1.3rem !important;
  }
  
  .page-actions {
    flex-direction: column;
    width: 100%;
    gap: 0.5rem;
  }
  
  .page-actions .btn, .page-actions button, .page-actions input, .page-actions select {
    width: 100%;
    justify-content: center;
  }
  
  .stat-cards {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .stat-value {
    font-size: 1.6rem !important;
  }
  
  .stat-label {
    font-size: 0.75rem;
  }
  
  .recharts-wrapper {
    max-width: 100% !important;
  }

  /* TOUCH TARGETS & INPUTS */
  button, input, select, textarea {
    min-height: 44px;
    font-size: 16px !important;
    touch-action: manipulation;
  }

  /* MOBILE CARD LIST (Replaces DataTables) */
  .desktop-table {
    display: none !important;
  }
  
  .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  
  .mobile-card {
    background: #fff;
    border: 1px solid var(--df-border);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .mobile-card.clickable:active {
    background: #f1f5f9;
  }
  
  .card-row {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    border-bottom: 1px dashed var(--df-border);
    padding-bottom: 0.5rem;
  }
  
  .card-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .card-header-row {
    border-bottom: 1px solid var(--df-border);
    padding-bottom: 0.75rem;
    margin-bottom: 0.25rem;
  }
  
  .card-label {
    font-size: 0.78rem;
    color: var(--df-text-muted);
    font-weight: 600;
  }
  
  .card-value {
    font-size: 0.9rem;
    color: var(--df-text);
    font-weight: 600;
    text-align: right;
  }
  
  .card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--df-border);
  }
  
  .card-actions button {
    flex: 1;
    min-height: 40px;
    font-size: 0.85rem;
    padding: 0.5rem;
  }
  
  /* SCROLLING TABLES (For tables that remain tables) */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
  }
  
  /* FORM GRID to 1 column */
  .form-grid, .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr !important;
    gap: 1rem;
  }

  /* ORDER / RECEIPT LINES */
  .order-line, .receipt-line, .order-line-mobile, .receipt-line-mobile {
    background: #f8fafc;
    border: 1px solid var(--df-border);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  /* Tabs */
  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    gap: 0.5rem;
  }
  .tab {
    min-height: 44px;
    white-space: nowrap;
  }
}

/* ==========================================================================
   📱 MODAL BOTTOM SHEET (≤ 640px)
   ========================================================================== */
@media (max-width: 640px) {
  .modal-backdrop {
    padding: 0;
    align-items: flex-end;
  }
  
  .modal-sheet {
    width: 100vw !important;
    min-height: 50dvh;
    max-height: 95dvh;
    margin: 0 !important;
    border-radius: 20px 20px 0 0 !important;
    position: fixed;
    bottom: 0;
    left: 0;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
  }
  
  .modal-sheet::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: #cbd5e1;
    margin: 0.5rem auto 0.5rem;
  }
  
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  .modal-sheet .modal-header {
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 10;
    padding: 0.75rem 1.25rem 1rem;
    border-bottom: 1px solid var(--df-border);
  }
  
  .modal-sheet .modal-body {
    overflow-y: auto;
    padding: 1rem 1.25rem 2rem;
    flex: 1;
  }
  
  .modal-sheet .form-actions {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding: 1rem;
    border-top: 1px solid var(--df-border);
    display: flex;
    gap: 0.75rem;
  }
  .modal-sheet .form-actions button {
    flex: 1;
  }
}
`;

fs.writeFileSync(path, code + '\n' + mobileCSS);
console.log('Successfully updated global.css');
