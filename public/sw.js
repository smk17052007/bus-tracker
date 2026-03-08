self.addEventListener("install", event => {

event.waitUntil(
caches.open("bus-tracker-cache")
.then(cache => {

return cache.addAll([
"/student.html",
"/manifest.json"
]);

})
);

});