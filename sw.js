// Define a name for the cache
const CACHE_NAME = 'salary-manager-v1';

// List all the files that need to be cached for the app to work offline
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// Install event: This is triggered when the service worker is first installed.
self.addEventListener('install', event => {
  // Wait until the installation is complete
  event.waitUntil(
    // Open the cache
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all the specified files to the cache
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: This is triggered for every network request the page makes.
self.addEventListener('fetch', event => {
  event.respondWith(
    // Check if the requested resource is in the cache
    caches.match(event.request)
      .then(response => {
        // If a cached version is found, return it.
        if (response) {
          return response;
        }
        // Otherwise, try to fetch the resource from the network.
        return fetch(event.request);
      }
    )
  );
});