import React from 'react';

const ISLTranslator: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      {/* Main Content - Embedded Website */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 w-full">
          <iframe
            src="https://d276540p-5000.inc1.devtunnels.ms/"
            title="ISL Translation Service"
            className="w-full h-full min-h-[calc(100vh-8rem)] border-0"
            allow="camera; microphone; fullscreen"
            loading="eager"
          />
        </div>
      </main>

    </div>
  );
};

export default ISLTranslator;