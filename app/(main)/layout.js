import React from "react";

const MainLayout = ({ children }) => {
  return (
    <div className="container mx-auto w-full overflow-x-hidden px-3 py-20 sm:px-5 sm:py-24 lg:py-28">
      {children}
    </div>
  );
};

export default MainLayout;
