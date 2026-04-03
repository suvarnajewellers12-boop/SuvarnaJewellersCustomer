import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, BadgeCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import productNecklace from "@/assets/product-necklace.jpg";
import productBridalSet from "@/assets/product-bridal-set.jpg";
import productMangalsutra from "@/assets/product-mangalsutra.jpg";
import productBangles from "@/assets/product-bangles.jpg";
import productEarrings from "@/assets/product-earrings.jpg";
import productPooja from "@/assets/product-pooja.jpg";

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

const products: Product[] = [
  { name: "Gold Necklace", grams: "200 gms", numgrams: 200, image: productNecklace, description: "A masterpiece of traditional Indian craftsmanship, this temple-style gold necklace features intricate kundan work and delicate filigree patterns passed down through generations.", story: "In Indian tradition, a gold necklace symbolizes prosperity and is often the centerpiece of a bride's trousseau, carrying blessings from one generation to the next.", category: "gold", subcategory: "Gold Chains" },
  { name: "Bridal Temple Set", grams: "350 gms", numgrams: 350, image: productBridalSet, description: "Complete bridal ensemble featuring a statement necklace, matching jhumka earrings, and maang tikka, all crafted in 22K gold with precious stone settings.", story: "The bridal set represents the coming together of two families, each piece carefully chosen to honor the sacred bond of marriage in Indian culture.", category: "gold", subcategory: "Gold Bangles" },
  { name: "Diamond Mangalsutra", grams: "100 gms", numgrams: 100, image: productMangalsutra, description: "A contemporary take on the sacred mangalsutra, blending traditional black beads with a stunning diamond-encrusted gold pendant.", story: "The mangalsutra is the most sacred piece of jewelry in Indian marriages — a symbol of love, commitment, and the eternal bond between husband and wife.", category: "gold", subcategory: "Gold Chains" },
  { name: "Gold Bangles", grams: "120 gms", numgrams: 120, image: productBangles, description: "Set of six intricately designed gold bangles featuring traditional temple motifs and meenakari enamel work in vibrant colors.", story: "The jingling of gold bangles has been the sound of celebration in Indian households for millennia, from festivals to weddings.", category: "gold", subcategory: "Gold Bangles" },
  { name: "Bridal Earrings", grams: "80 gms", numgrams: 80, image: productEarrings, description: "Grand bridal jhumka earrings with kundan setting, pearl drops, and detailed gold filigree work that catches every ray of light.", story: "Jhumkas have adorned Indian women since the Mughal era, their bell-shaped design creating a mesmerizing dance of light and sound.", category: "gold", subcategory: "Gold Rings" },
  { name: "Silver Pooja Collection", grams: "790 gms", numgrams: 790, image: productPooja, description: "Complete silver pooja set including an ornate thali, diya, kalash, and accessories — perfect for daily worship and special ceremonies.", story: "Every Indian home has a sacred space for worship. This collection brings divinity and beauty to your daily rituals.", category: "silver", subcategory: "Silver Idols" },
];

const subcategories: Record<Category, string[]> = {
  gold: ["All", "Gold Rings", "Gold Chains", "Gold Bangles", "Gold Anklets"],
  silver: ["All", "Silver Idols", "Silver Earrings", "Silver Chains", "Silver Anklets"],
};

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

const ProductModal = ({ product, onClose }: { product: Product; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-md"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 40 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.85, opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 22, stiffness: 260 }}
      onClick={(e) => e.stopPropagation()}
      className="glass-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0"
      style={{ boxShadow: '0 30px 80px -20px hsla(30, 30%, 15%, 0.25), 0 0 0 1px hsla(38, 60%, 55%, 0.2)' }}
    >
      <div className="relative">
        <div className="aspect-video overflow-hidden rounded-t-3xl bg-cream spotlight">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-pearl/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-pearl transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-gold/20 backdrop-blur-sm flex items-center justify-center text-gold-dark">
          <RotateCcw className="w-5 h-5" />
        </div>
      </div>
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-2xl font-bold text-foreground">{product.name}</h3>
          <span className="font-display text-xl font-bold text-gold-gradient">{product.grams}</span>
        </div>
        <p className="font-body text-muted-foreground mb-6">{product.description}</p>
        <div className="border-t border-gold/20 pt-6">
          <h4 className="font-elegant text-lg italic text-gold-dark mb-2">Cultural Inspiration</h4>
          <p className="font-body text-sm text-muted-foreground">{product.story}</p>
        </div>
        <div className="mt-6 p-4 rounded-xl bg-gold/5 border border-gold/15">
          <p className="font-body text-sm text-center text-muted-foreground">
            ✦ Available through our exclusive savings schemes ✦
          </p>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const ProductsSection = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("gold");
  const [activeSubcategory, setActiveSubcategory] = useState("All");
  const { isLoggedIn, enrolledSchemes } = useAuth();
  const totalSaved = enrolledSchemes.reduce((acc, s) => acc + s.monthlyAmount * s.paidMonths, 0);

  const filteredProducts = products.filter(
    (p) =>
      p.category === activeCategory &&
      (activeSubcategory === "All" || p.subcategory === activeSubcategory)
  );

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setActiveSubcategory("All");
  };

  return (
    <section id="products" className="py-28 px-4 relative overflow-hidden">
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
          <p className="font-elegant text-base tracking-[0.3em] uppercase text-gold-dark mb-3">Curated Collection</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Exquisite <span className="text-gold-gradient-shine">Treasures</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            Each piece tells a story of heritage, crafted with devotion and designed to be cherished for generations.
          </p>
        </motion.div>

        {/* Category tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center gap-4 mb-6"
        >
          {(["gold", "silver"] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className="relative px-8 py-2.5 rounded-full font-display text-sm tracking-wider uppercase transition-all duration-400"
              style={{
                background: activeCategory === cat
                  ? 'var(--gradient-gold)'
                  : 'hsla(40, 28%, 97%, 0.6)',
                color: activeCategory === cat
                  ? 'hsl(40, 30%, 97%)'
                  : 'hsl(28, 25%, 15%)',
                border: activeCategory === cat
                  ? '1px solid hsla(43, 80%, 60%, 0.5)'
                  : '1px solid hsla(38, 50%, 65%, 0.3)',
                boxShadow: activeCategory === cat
                  ? 'var(--shadow-gold)'
                  : 'none',
              }}
            >
              {cat === "gold" ? "Gold Jewellery" : "Silver Jewellery"}
            </button>
          ))}
        </motion.div>

        {/* Subcategory chips */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-16"
        >
          {subcategories[activeCategory].map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className="px-5 py-1.5 rounded-full font-body text-xs tracking-wide transition-all duration-300"
              style={{
                background: activeSubcategory === sub
                  ? 'hsla(43, 80%, 55%, 0.15)'
                  : 'transparent',
                color: activeSubcategory === sub
                  ? 'hsl(38, 72%, 38%)'
                  : 'hsl(28, 12%, 40%)',
                border: activeSubcategory === sub
                  ? '1px solid hsla(43, 80%, 55%, 0.4)'
                  : '1px solid hsla(38, 50%, 65%, 0.2)',
              }}
            >
              {sub}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + activeSubcategory}
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
                  className="product-card cursor-pointer group spotlight"
                >
                  <div className="aspect-square overflow-hidden rounded-t-2xl bg-cream relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-foreground/8 to-transparent pointer-events-none" />
                    {isLoggedIn && totalSaved > 0 && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pearl/90 backdrop-blur-sm border border-gold/20">
                        <BadgeCheck className="w-3.5 h-3.5 text-gold-dark" />
                        <span className="font-body text-[11px] font-semibold text-foreground">Eligible via savings</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">{product.name}</h3>
                    <p className="font-display text-xl font-bold text-gold-gradient">{product.grams}</p>
                    {isLoggedIn && totalSaved > 0 && (
                      <p className="font-body text-xs text-gold-dark mt-1">
                        Redeem {formatINR(Math.min(totalSaved, product.numgrams))} from saved gold
                      </p>
                    )}
                    <p className="font-body text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Click to explore ✦</p>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      <div className="absolute bottom-0 left-0 right-0 gold-divider" />
    </section>
  );
};

export default ProductsSection;
