/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import BondDashboard from './components/BondDashboard';
import WeeklyMarketTool from './components/WeeklyMarketTool';

export default function App() {
  if (window.location.pathname.startsWith('/weekly')) {
    return <WeeklyMarketTool />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <BondDashboard />
    </div>
  );
}
