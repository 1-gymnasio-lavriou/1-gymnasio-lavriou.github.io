/* ────────────────────────────────────────────────────────────────
   Service worker: κάνει τη σελίδα να ανοίγει και χωρίς ίντερνετ.

   ΠΟΤΕ ΝΑ ΑΛΛΑΞΕΤΕ ΚΑΤΙ ΕΔΩ: μόνο τον αριθμό έκδοσης από κάτω,
   κάθε φορά που ανεβάζετε αλλαγμένη σελίδα. Έτσι οι επισκέπτες
   που την έχουν ήδη ανοίξει παίρνουν τη νέα εκδοχή.
   ──────────────────────────────────────────────────────────────── */
var VERSION = 'erasmus-lavrio-v2';
var SHELL   = VERSION + '-shell';
var RUNTIME = VERSION + '-runtime';

var FILES = [
  './', './index.html', './share.jpg', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL).then(function(c){
      return Promise.all(FILES.map(function(f){
        return c.add(f).catch(function(){ /* αν λείπει κάποιο αρχείο, προχωράμε */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function fromNetwork(req, cacheName){
  return fetch(req).then(function(res){
    if (res && (res.ok || res.type === 'opaque')){
      var copy = res.clone();
      caches.open(cacheName).then(function(c){ c.put(req, copy); });
    }
    return res;
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;

  /* άνοιγμα της σελίδας: πρώτα δίκτυο, αλλιώς η αποθηκευμένη εκδοχή */
  if (req.mode === 'navigate'){
    e.respondWith(
      fromNetwork(req, SHELL).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }

  var sameOrigin = new URL(req.url).origin === self.location.origin;

  /* δικά μας αρχεία: πρώτα από την κρυφή μνήμη, ώστε να ανοίγει ακαριαία */
  if (sameOrigin){
    e.respondWith(
      caches.match(req).then(function(hit){
        return hit || fromNetwork(req, SHELL).catch(function(){ return hit; });
      })
    );
    return;
  }

  /* εικόνες και δεδομένα από αλλού (αναρτήσεις, φωτογραφίες, γραμματοσειρές):
     πρώτα δίκτυο, και αν δεν υπάρχει σύνδεση, ό,τι έχει μείνει αποθηκευμένο */
  e.respondWith(
    fromNetwork(req, RUNTIME).catch(function(){ return caches.match(req); })
  );
});
