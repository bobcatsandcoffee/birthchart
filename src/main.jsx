import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from './App.jsx'; // Your main birth chart app
import Art from './Art.jsx'; // Your new art generator app

// Define the pages (routes) for your website
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/art",
    element: <Art />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
