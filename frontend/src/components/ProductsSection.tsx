import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type Category = "gold" | "silver";

interface Product {
  name: string;
  grams: string;
  numgrams: number;
  image: string;
  description: string;
  story: string;
  category: Category;
  subcategory: string;
}

// Module-level cache — survives page navigation, resets on browser refresh
let _cachedProducts: Product[] | null = null;

const ProductModal = ({ product, onClose }: { product: Product; onClose: () => void }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ACCESSIBILITY FIX: Dialog focus trapping, initial focus placement, and Esc key closure
  useEffect(() => {
    // Save element that was focused before opening modal
    const previousFocusedElement = document.activeElement as HTMLElement;
    
    // Automatically move keyboard focus to the close button inside the modal dialog
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        // Grab all focusable children inside the modal dialog
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift + Tab: trap backwards loop
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          // Tab: trap forwards loop
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    
    // Clean up focus trap state and return focus to element that triggered dialog
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusedElement) {
        previousFocusedElement.focus();
      }
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0"
        style={{ boxShadow: '0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)' }}
      >
        <div className="relative">
          <div className="aspect-video overflow-hidden rounded-t-3xl bg-cream spotlight flex items-center justify-center p-2">
            <img
              src={product.image}
              alt=""
              aria-hidden="true"
              className="max-w-full max-h-full w-auto h-auto object-contain hover:scale-105 transition-transform duration-700"
            />
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-pearl/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-pearl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 id="modal-title" className="font-display text-2xl font-bold text-foreground">{product.name}</h3>
            <span className="font-display text-xl font-bold text-gold-gradient">{product.grams}</span>
          </div>
          <p className="font-body text-muted-foreground mb-6">{product.description}</p>
          <div className="border-t border-gold/20 pt-6">
            <h4 className="font-elegant text-lg italic text-gold-dark mb-2">Cultural Inspiration</h4>
            <p className="font-body text-sm text-muted-foreground">{product.story}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ProductsSection = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Start with cache if available — no layout jump spinner on revisit
  const [products, setProducts] = useState<Product[]>(_cachedProducts ?? []);
  const [loading, setLoading] = useState(_cachedProducts === null);

  const [activeCategory, setActiveCategory] = useState<Category>("gold");

  useEffect(() => {
    // Cache exists — skip network call entirely
    if (_cachedProducts !== null) return;

    const fetchProducts = async () => {
      try {
        const res = await fetch("https://suvarnagold-16e5.vercel.app/api/productsimgs/list");
        const data = await res.json();

        const mapped: Product[] = data.map((item: any) => {
          const isSilver = item.metalType?.toLowerCase() === "silver";
          const metalCategory: Category = isSilver ? "silver" : "gold";
          const titleLower = (item.title || "").toLowerCase();

          // DYNAMIC SUBCATEGORY RESOLUTION DETECTOR
          let determinedSubcategory = isSilver ? "Silver Idols" : "Gold Chains";

          if (isSilver) {
            if (titleLower.includes("ring")) determinedSubcategory = "Silver Rings"; 
            else if (titleLower.includes("earring")) determinedSubcategory = "Silver Earrings";
            else if (titleLower.includes("chain") || titleLower.includes("necklace")) determinedSubcategory = "Silver Chains";
            else if (titleLower.includes("anklet") || titleLower.includes("payal")) determinedSubcategory = "Silver Anklets";
            else if (titleLower.includes("bangle") || titleLower.includes("kangan") || titleLower.includes("bracelet")) determinedSubcategory = "Silver Bangles";
            else if (titleLower.includes("idol") || titleLower.includes("coin") || item.category?.toLowerCase().includes("idol")) determinedSubcategory = "Silver Idols";
          } else {
            if (titleLower.includes("ring")) determinedSubcategory = "Gold Rings";
            else if (titleLower.includes("chain") || titleLower.includes("necklace")) determinedSubcategory = "Gold Chains";
            else if (titleLower.includes("bangle") || titleLower.includes("kangan") || titleLower.includes("bracelet")) determinedSubcategory = "Gold Bangles";
            else if (titleLower.includes("anklet")) determinedSubcategory = "Gold Anklets";
          }

          return {
            name: item.title,
            grams: `${item.weight} gms`,
            numgrams: item.weight,
            image: item.image,
            description: item.description || "No description available",
            story: item.description || "Traditional craftsmanship from Suvarna Jewellers.",
            category: metalCategory,
            subcategory: determinedSubcategory,
          };
        });

        _cachedProducts = mapped; // store in module cache
        setProducts(mapped);
      } catch (error) {
        console.error("Products fetch failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleCategoryKeyDown = (e: React.KeyboardEvent, currentCat: Category) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const nextCat = currentCat === "gold" ? "silver" : "gold";
      setActiveCategory(nextCat);
      
      // Auto-focus next active tab element based on keyboard selection pattern
      const targetBtn = document.getElementById(`tab-${nextCat}`);
      targetBtn?.focus();
    }
  };

  const filteredProducts = products.filter((p) => p.category === activeCategory);

  if (loading) {
    return (
      <section id="products" className="py-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-cream" />
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-elegant italic text-gold-dark">Loading Collection...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" aria-labelledby="products-heading" className="py-28 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cream via-pearl to-cream" />
      <div className="absolute inset-0" style={{ background: 'var(--gradient-spotlight)' }} />
      <div className="absolute top-0 left-0 right-0 gold-divider" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">
            Curated Collection
          </p>
          {/* ACCESSIBILITY FIX: Switched from h2 to h1 to establish the proper heading structure level */}
          <h1 id="products-heading" className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Exquisite <span className="text-gold-gradient-shine">Treasures</span>
          </h1>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Each piece tells a story of heritage, crafted with devotion and designed to be cherished for generations.
          </p>
        </motion.div>

        {/* ACCESSIBILITY FIX: Wrapped navigation controls with appropriate semantic landmarks & WAI-ARIA Tabs Structure */}
        <nav aria-label="Product Category Filter" className="flex justify-center mb-16">
          <div 
            role="tablist" 
            aria-label="Jewellery Categories"
            className="flex gap-4"
          >
            {(["gold", "silver"] as Category[]).map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  id={`tab-${cat}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="products-grid"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveCategory(cat)}
                  onKeyDown={(e) => handleCategoryKeyDown(e, cat)}
                  className="relative px-8 py-2.5 rounded-full font-display text-sm tracking-wider uppercase transition-all duration-400"
                  style={{
                    background: isActive ? 'var(--gradient-gold)' : 'hsla(40, 28%, 97%, 0.6)',
                    color: isActive ? 'hsl(40, 30%, 97%)' : 'hsl(28, 25%, 15%)',
                    border: isActive
                      ? '1px solid hsla(43, 80%, 60%, 0.5)'
                      : '1px solid hsla(38, 50%, 65%, 0.3)',
                    boxShadow: isActive ? 'var(--shadow-gold)' : 'none',
                  }}
                >
                  {cat === "gold" ? "Gold Jewellery" : "Silver Jewellery"}
                </button>
              );
            })}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            id="products-grid"
            role="tabpanel"
            aria-labelledby={`tab-${activeCategory}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <p className="font-elegant text-lg italic text-muted-foreground">
                  New pieces arriving soon. Stay tuned for our latest creations.
                </p>
              </div>
            ) : (
              filteredProducts.map((product, index) => (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.12 }}
                  onClick={() => setSelectedProduct(product)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProduct(product);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Explore ${product.name}, weight ${product.grams}`}
                  className="product-card cursor-pointer group spotlight outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <div className="aspect-square overflow-hidden rounded-t-2xl bg-cream relative">
                    <img
                      src={product.image}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-foreground/8 to-transparent pointer-events-none" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                      {product.name}
                    </h3>
                    <p className="font-display text-xl font-bold text-gold-gradient">{product.grams}</p>
                    <p className="font-body text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      Click to explore ✦
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>

      <div className="absolute bottom-0 left-0 right-0 gold-divider" />
    </section>
  );
};

export default ProductsSection;