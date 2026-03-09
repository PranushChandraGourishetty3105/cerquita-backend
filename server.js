const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE"],
}));

app.use(express.json({ limit: "10mb" }));

/* ================= CREATE UPLOAD FOLDER ================= */

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ================= SERVE IMAGES ================= */

app.use("/uploads", express.static(uploadDir));

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB Atlas Connected"))
.catch(err=>console.log("MongoDB Error:",err));

/* ================= MULTER ================= */

const storage = multer.diskStorage({

destination:(req,file,cb)=>{
cb(null, uploadDir);
},

filename:(req,file,cb)=>{
cb(null, Date.now()+path.extname(file.originalname));
}

});

const upload = multer({storage});

/* ================= HEALTH ================= */

app.get("/",(req,res)=>{
res.send("Cerquita Backend Running 🚀");
});

/* ================= USER SCHEMA ================= */

const userSchema = new mongoose.Schema({
name:String,
email:{type:String,unique:true},
password:String,
role:String
});

const User = mongoose.model("User",userSchema);

/* ================= VENDOR SCHEMA ================= */

const vendorSchema = new mongoose.Schema({
email:{type:String,unique:true},
shopName:String,
proprietorName:String,
address:String,
latitude:Number,
longitude:Number,
openingTime:String,
closingTime:String,
contactNumber:String,
shopImage:String
});

const Vendor = mongoose.model("Vendor",vendorSchema);

/* ================= PRODUCT SCHEMA ================= */

const productSchema = new mongoose.Schema({
vendorEmail:String,
productName:String,
price:Number,
quantity:String,
image:String,
category:String
});

const Product = mongoose.model("Product",productSchema);

/* ================= REGISTER ================= */

app.post("/register",async(req,res)=>{

try{

const {name,email,password,role}=req.body;

if(!name||!email||!password){

return res.json({
success:false,
message:"All fields required"
});

}

const existingUser=await User.findOne({email});

if(existingUser){

return res.json({
success:false,
message:"User already exists"
});

}

const hashedPassword=await bcrypt.hash(password,10);

const user=new User({
name,
email,
password:hashedPassword,
role
});

await user.save();

res.json({
success:true,
message:"User registered successfully"
});

}catch(err){

console.log(err);

res.json({
success:false,
message:"Server error"
});

}

});

/* ================= LOGIN ================= */

app.post("/login",async(req,res)=>{

try{

const {email,password}=req.body;

const user=await User.findOne({email});

if(!user){

return res.json({
success:false,
message:"User not found"
});

}

const isMatch=await bcrypt.compare(password,user.password);

if(!isMatch){

return res.json({
success:false,
message:"Invalid password"
});

}

res.json({
success:true,
email:user.email,
name:user.name,
role:user.role
});

}catch(err){

console.log(err);

res.json({
success:false,
message:"Server error"
});

}

});

/* ================= CHECK VENDOR SHOP ================= */

app.post("/vendor/check",async(req,res)=>{

try{

const {email}=req.body;

const vendor=await Vendor.findOne({email});

if(!vendor){
return res.json({exists:false});
}

res.json({
exists:true,
vendor
});

}catch(err){

console.log(err);
res.json({exists:false});

}

});

/* ================= CREATE OR UPDATE SHOP ================= */

app.post("/vendor/create", upload.single("image"), async (req,res)=>{

try{

const {
email,
shopName,
proprietorName,
address,
openingTime,
closingTime,
contactNumber,
latitude,
longitude
} = req.body;

let vendor = await Vendor.findOne({email});

const imageUrl = req.file
? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
: "";

if(vendor){

await Vendor.updateOne(
{email},
{
shopName,
proprietorName,
address,
openingTime,
closingTime,
contactNumber,
latitude:Number(latitude),
longitude:Number(longitude),
...(imageUrl && { shopImage: imageUrl })
}
);

return res.json({
success:true,
message:"Shop updated successfully"
});

}

vendor = new Vendor({
email,
shopName,
proprietorName,
address,
openingTime,
closingTime,
contactNumber,
latitude:Number(latitude),
longitude:Number(longitude),
shopImage:imageUrl
});

await vendor.save();

res.json({
success:true,
message:"Shop created successfully"
});

}catch(err){

console.log("SHOP ERROR:",err);

res.json({
success:false,
message:"Server error"
});

}

});

/* ================= GET SHOP ================= */

app.get("/vendor/shop/:email",async(req,res)=>{

try{

const shop=await Vendor.findOne({email:req.params.email});

res.json({
success:true,
shop
});

}catch(err){

res.json({
success:false
});

}

});

/* ================= ADD PRODUCT ================= */

app.post("/product/add",upload.single("image"),async(req,res)=>{

try{

const {vendorEmail,productName,price,quantity,category}=req.body;

if(!vendorEmail||!productName||!price||!quantity){

return res.json({
success:false,
message:"Missing fields"
});

}

const imageUrl = req.file
? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
: "";

const product=new Product({
vendorEmail,
productName,
price,
quantity,
category,
image:imageUrl
});

await product.save();

res.json({
success:true,
message:"Product added successfully"
});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

/* ================= PRODUCT LIST ================= */

app.post("/product/list",async(req,res)=>{

try{

const {email}=req.body;

const products=await Product.find({vendorEmail:email});

res.json({
success:true,
products
});

}catch(err){

console.log(err);

res.json({
success:false,
products:[]
});

}

});

/* ================= DELETE PRODUCT ================= */

app.delete("/product/delete/:id",async(req,res)=>{

try{

await Product.findByIdAndDelete(req.params.id);

res.json({success:true});

}catch(err){

res.json({success:false});

}

});

/* ================= ALL VENDORS ================= */

app.get("/vendors",async(req,res)=>{

try{

const vendors=await Vendor.find({
latitude:{$ne:null},
longitude:{$ne:null}
});

res.json({
success:true,
vendors
});

}catch(err){

console.log(err);

res.json({
success:false,
vendors:[]
});

}

});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});