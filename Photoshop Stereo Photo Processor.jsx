/* =================

Photoshop Stereo Photo Processor Script
Input: A parallel stereo image (a single, side-by-side, left image on the left)
Output: A suite of stereo photo jpegs, a layered Photoshop PSD with each format, and an XML manifest

Author: Mat Bergman
Web: www.matbergman.com
Version: 0.1, 4/2/2015
Source: 
License: The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

================= */


/* == Save the current preferences, and set preferences for this session == */
var startRulerUnits = app.preferences.rulerUnits
var startDisplayDialogs = app.displayDialogs
app.preferences.rulerUnits = Units.PIXELS
app.displayDialogs = DialogModes.NO

/* == Global variables == */
var inputFolder = Folder("/Users/matb/Dropbox/gallery/originals");
var outputFolder = "/Users/matb/Dropbox/gallery/processed/";
var psdFolder = "/Users/matb/Dropbox/gallery/psd/";

var photoTitle;
var maxResizedWidth = 960 // The widest dimension for processed parallel/crosseyed images in the gallery
var maxResizedHeight = 480 // The tallest dimension for processed parallel/crosseyed images in the gallery
var theWidth;
var theHeight;
var theSelection;
var anaglyphDocument;

var xmlArray = new Array(); // Holds the XML data before writing to a file
var xmlTitle;    
var xmlPhotographer;
var xmlMonth;
var xmlMonthName;
var xmlYear;
var xmlDatestamp;
var xmlGroup;
var xmlScore;
var xmlFilename;
var xmlCurrentSelection; // keeps track of the length of the xml array when new photos are added

/* == Load jpegs from the input folder, check before processing == */
var fileList = inputFolder.getFiles("*.jpg")

// Let us know if it has trouble with the input files
if (fileList.length == 0) {alert("No files found in input folder: "+inputFolder)}

for (i=0;i<fileList.length;i++) {

    // The fileList is folders and files so open only files
    if (fileList[i] instanceof File) {
        open(fileList[i])

        // Define this document's name for switching between documents
        var document_workfile = app.activeDocument;

        // Make sure the document's color mode is RGB
        if (document_workfile.mode !=DocumentMode.RGB) {document_workfile.changeMode(ChangeMode.RGB)}
 
        theWidth = document_workfile.width;
        theHeight = document_workfile.height;

        // Create a dialog to collect data about the image (name, photographer, etc.)
        // Pre-fill some fields with suggested defaults
        var theDate = new Date();
        var currentMonth = theDate.getMonth();
        var currentYear = theDate.getFullYear();
        var currentMonthArray = new Array("January","February","March","April","May","June","July","August","September","October","November","December");
        // Suggest a file name at the prompt, based on the existing filename. Strip the extension (assume a 3 letter extention).
        var photoName = app.activeDocument.name.slice(0,-4)
        xmlFilename = app.activeDocument.name;

        // The modal dialog template
        var photoInfo =
        "dialog { alignChildren: 'fill', \
            photoInfoPanel: Panel { orientation: 'row', alignChildren:'left',  \
                title:'Enter Stereophoto Information',\
                text: 'Photo Information', \
                theTitle: Group { orientation: 'row', \
                    s: StaticText { text:'Title:' }, \
                    e: EditText { characters: 30, justify:'left', text:'"+photoName+"'} \
                    }, \
                thePhotographer: Group { orientation: 'row', \
                    s: StaticText { text:'Photographer:' }, \
                    e: EditText { characters: 30, justify:'left', text:'Firstname Lastname' } \
                    } \
                }, \
            competitionInfoPanel: Panel { orientation: 'column', alignChildren:'fill', spacing:10, \
                text: 'Competition Information', \
                datePanel: Panel { orientation: 'row', \
                    text:'Competition Date',\
                    theDate: Group { orientation: 'row', \
                        currentMonth: DropDownList { alignment:'left', title:'Month:',}, \
                        currentYear_label: StaticText {text:'Year:'},\
                        currentYear:  EditText { characters:4, text:'"+currentYear+"'}, \
                        } \
                    }, \
                groupPanel: Panel { orientation: 'row', \
                    text:'Group',\
                    theGroup: Group { orientation: 'row', \
                        group_0: RadioButton { text:'Group A', value:true }, \
                        group_1: RadioButton { text:'Group B' }, \
                        group_2: RadioButton { text:'Special Competition' }, \
                        group_2_desc: EditText {characters:20,text:'Special competition name'} \
                        } \
                    }, \
                scorePanel: Panel { orientation: 'row', \
                    text: 'Score', \
                    theScore: Group { orientation:'row', \
                        score_0: RadioButton { text:'None', value:true }, \
                        score_1: RadioButton { text:'1st' }, \
                        score_2: RadioButton { text:'2nd' }, \
                        score_3: RadioButton { text:'3rd' }, \
                        score_4: RadioButton { text:'4th' }, \
                        score_5: RadioButton { text:'Honorable Mention' } \
                        } \
                    } \
                }, \
            buttons: Group { orientation: 'row', \
            okBtn: Button { text:'OK', properties:{name:'ok'} }, \
            cancelBtn: Button { text:'Cancel', properties:{name:'cancel'} } \
            } \
         }";
            
        win = new Window (photoInfo, "Enter Stereophoto Information");

        // Populate the month drop-down and select the current month
        var monthItem;
        for (k=0;k<currentMonthArray.length;k++) {
            monthItem = win.competitionInfoPanel.datePanel.theDate.currentMonth.add('item',currentMonthArray[k]);
            }
        win.competitionInfoPanel.datePanel.theDate.currentMonth.selection = win.competitionInfoPanel.datePanel.theDate.currentMonth.items[currentMonth];

        // When the "OK" button is clicked, process the image
        win.buttons.okBtn.onClick=createStereoFiles;

        // Show the window
        win.center();
        win.show();

        }
    }

// Generate an XML file based on the collected values stored in the xmlArray array
writeXML();

alert ("Process complete. "+fileList.length+" files processed.");

/* == After running, reset the original preferences == */
app.preferences.rulerUnits = startRulerUnits
app.displayDialogs = startDisplayDialogs


/* == Create a suite of stereo images == */
function createStereoFiles() {
   
// Get the photo's title from the dialog
photoTitle = win.photoInfoPanel.theTitle.e.text;   

// Close the dialog to give some feedback that the process has started
win.close();

// Create parallel view

// The default input type is parallel, so just resize, sharpen & save it
var layerSet_parallel = document_workfile.layerSets.add()
layerSet_parallel.name = "parallel"
var parallel = document_workfile.backgroundLayer.duplicate(layerSet_parallel, ElementPlacement.PLACEATEND)
layerSet_parallel.layers[0].name = "parallel"

// Create crosseyed view

 // Create a group for the crosseyed set
var layerSet_crosseyed = document_workfile.layerSets.add()
layerSet_crosseyed.name = "crosseyed"

// Make two copies of the background to manipulate each image individually
var left_crosseyed = document_workfile.backgroundLayer.duplicate(layerSet_crosseyed, ElementPlacement.PLACEATEND)
var right_crosseyed = document_workfile.backgroundLayer.duplicate(layerSet_crosseyed, ElementPlacement.PLACEATEND)

layerSet_crosseyed.layers[0].name = "left"
layerSet_crosseyed.layers[1].name = "right"

// Move each image for proper crosseyed arrangement 
layerSet_crosseyed.layers["left"].translate((theWidth/2),0)
layerSet_crosseyed.layers["right"].translate(((theWidth/2)*-1),0)

// Create red/cyan and green/magenta anaglyph

// Define the channel values for the mixChannel function. See the Channel Mixer tool in Photoshop for array values. Encode as a string so that they can be passed as a variable to a function.
var redMix      = "Array(Array(100,0,0,0),Array(0,0,0,0),Array(0,0,0,0));" 
var blueMix     = "Array(Array(0,0,0,0),Array(0,100,0,0),Array(0,0,100,0));" 
var greenMix    = "Array(Array(0,0,0,0),Array(0,100,0,0),Array(0,0,0,0));" 
var magentaMix  = "Array(Array(100,0,0,0),Array(0,0,0,0),Array(0,0,100,0));" 

// Define the types of anaglyps to generate. Set variables for the layer sets that will be created for each type.
var anaglyphTypes = [
   ["redBlue",redMix,blueMix],
   ["greenMagenta",greenMix,magentaMix]
]
var layerSet_redBlue
var layerSet_greenMagenta

// Create each type of anaglyph
for (j=0;j<anaglyphTypes.length;j++) {

   // Create layer set
   theLayerSet = document_workfile.layerSets.add()
   theLayerSet.name = anaglyphTypes[j][0]

   // Make two copies of the background to manipulate each image individually
   var layerLeft = document_workfile.backgroundLayer.duplicate(theLayerSet, ElementPlacement.PLACEATEND)
   var layerRight = document_workfile.backgroundLayer.duplicate(theLayerSet, ElementPlacement.PLACEATEND)
   theLayerSet.layers[0].name = "left"
   theLayerSet.layers[1].name = "right"

   // Overlay the images
   var moveAmount = (theWidth/2)*-1;
   theLayerSet.layers["right"].translate(moveAmount,0)

   // Desaturate each image to reduce clashing colors
   document_workfile.activeLayer = theLayerSet.layers["left"]
   saturation(0,-50,0)
   document_workfile.activeLayer = theLayerSet.layers["right"]
   saturation(0,-50,0)

   // Select and trim the anaglyph
   var anaglyphSelect = [ [(theWidth/2),0],[(theWidth/2),theHeight],[theWidth,theHeight],[theWidth,0] ]
   document_workfile.selection.select(anaglyphSelect)
   document_workfile.activeLayer = theLayerSet.layers["left"]
   document_workfile.selection.cut()

   // Adjust channels and blend the stereo pair
   applyAnaglyph(anaglyphTypes[j][1], theLayerSet.layers["left"])   
   applyAnaglyph(anaglyphTypes[j][2], theLayerSet.layers["right"])
   theLayerSet.layers["left"].blendMode = BlendMode.SCREEN
   }

layerSet_redBlue = document_workfile.layerSets.getByName("redBlue")
layerSet_greenMagenta = document_workfile.layerSets.getByName("greenMagenta")

/* == Save, process, and export files == */

// Save a PSD of these changes
var psdOptions = new PhotoshopSaveOptions()
psdOptions.embedColorProfile = false
psdOptions.layers = true
document_workfile.saveAs(new File(psdFolder+photoTitle+"_gallery.psd"),psdOptions)

// Resize for the web gallery
resizeImage(document_workfile)

// Sharpen each layer after resizing
for (m=0; m<document_workfile.layerSets.length; m++) {
   for (n=0; n<document_workfile.layerSets[m].artLayers.length; n++) {
      document_workfile.layerSets[m].artLayers[n].applyUnSharpMask(25,1,0)
      }
   }

// Save parallel view
// Replace spaces with underscores, and make all file names lowercase
displayLayerSet("parallel")
saveForWeb( document_workfile, new File(outputFolder+photoTitle.replace(/ /g,'_').toLowerCase()+'_0.jpg'), 60 )

 // Save crosseyed view
displayLayerSet("crosseyed")
saveForWeb( document_workfile, new File(outputFolder+photoTitle.replace(/ /g,'_').toLowerCase()+'_1.jpg'), 60 )


// Save red/blue anaglyph view
// Merge the left and right images and copy both
displayLayerSet("redBlue")     
activeLayer = layerSet_redBlue.layers["left"]
activeLayer.merge()
document_workfile.activeLayer.copy(true)

// Since the anaglyph image is half as wide as the workfile, create a new image with the correct dimensions
document_anaglyph_redBlue = app.documents.add(document_workfile.width/2,document_workfile.height,72,"anaglyphDocument",NewDocumentMode.RGB)
document_anaglyph_redBlue.paste()
saveForWeb(document_anaglyph_redBlue, new File(outputFolder+photoTitle.replace(/ /g,'_').toLowerCase()+'_2.jpg'), 60 )

// Switch back to the workfile document
app.activeDocument=document_workfile


 // Save green/magenta anaglyph view
// Merge the left and right images and copy both
displayLayerSet("greenMagenta")    
activeLayer = layerSet_greenMagenta.layers["left"]
activeLayer.merge()
document_workfile.activeLayer.copy(true)
document_anaglyph_greenMagenta = app.documents.add(document_workfile.width/2,document_workfile.height,72,"anaglyphDocument",NewDocumentMode.RGB)
document_anaglyph_greenMagenta.paste()
saveForWeb(document_anaglyph_greenMagenta, new File(outputFolder+photoTitle.replace(/ /g,'_').toLowerCase()+'_3.jpg'), 60 )
app.activeDocument=document_workfile

// Close the documents
document_workfile.close(SaveOptions.DONOTSAVECHANGES)
document_anaglyph_redBlue.close(SaveOptions.DONOTSAVECHANGES)
document_anaglyph_greenMagenta.close(SaveOptions.DONOTSAVECHANGES)

// Generate an entry for the XML file
createXML();

}

function resizeImage(doc) {
// Resize the image for the web gallery
if ((doc.width/2) > doc.height) {
   // Horizontal images: resize to max width
   doc.resizeImage(UnitValue(maxResizedWidth,"px"),null,null,ResampleMethod.BICUBIC)
   }
else {
   // Vertical images: resize to max height
   doc.resizeImage(null,UnitValue(maxResizedHeight,"px"),null,ResampleMethod.BICUBIC)
   }   
}

function saveForWeb( doc, saveFile, quality ) {
var options = new ExportOptionsSaveForWeb();
options.quality = quality;
options.format = SaveDocumentType.JPEG;
doc.exportDocument(saveFile, ExportType.SAVEFORWEB, options);
}

function saturation(HAmt,StrtAmt,LghtAmt) {
var idHStr = charIDToTypeID( "HStr" );
var desc2 = new ActionDescriptor();
var idpresetKind = stringIDToTypeID( "presetKind" );
var idpresetKindType = stringIDToTypeID( "presetKindType" );
var idpresetKindCustom = stringIDToTypeID( "presetKindCustom" );
desc2.putEnumerated( idpresetKind, idpresetKindType, idpresetKindCustom );
var idClrz = charIDToTypeID( "Clrz" );
desc2.putBoolean( idClrz, false );
var idAdjs = charIDToTypeID( "Adjs" );
  var list1 = new ActionList();
      var desc3 = new ActionDescriptor();
      var idH = charIDToTypeID( "H   " );
      desc3.putInteger( idH, HAmt );
      var idStrt = charIDToTypeID( "Strt" );
      desc3.putInteger( idStrt, StrtAmt );
      var idLght = charIDToTypeID( "Lght" );
      desc3.putInteger( idLght, LghtAmt );
  var idHsttwo = charIDToTypeID( "Hst2" );
  list1.putObject( idHsttwo, desc3 );
desc2.putList( idAdjs, list1 );
executeAction( idHStr, desc2, DialogModes.NO );
}

function applyAnaglyph(mix, layerName) {layerName.mixChannels(eval(mix));}

function displayLayerSet(theLayerSet) {

// Hide all groups
for (s=0;s<document_workfile.layerSets.length;s++) {
   document_workfile.layerSets[s].visible = false
   }
   
// Display the selected group for export   
document_workfile.layerSets.getByName(theLayerSet).visible = true
}


/* == Create an XML file that's readable by the web gallery == */
function createXML() {
xmlCurrentSelection = xmlArray.length;    

xmlTitle = win.photoInfoPanel.theTitle.e.text;    
xmlPhotographer = win.photoInfoPanel.thePhotographer.e.text;
xmlMonth = parseInt(win.competitionInfoPanel.datePanel.theDate.currentMonth.selection);
xmlMonthName =  win.competitionInfoPanel.datePanel.theDate.currentMonth.selection.text;
xmlYear = parseInt(win.competitionInfoPanel.datePanel.theDate.currentYear.text);
xmlDatestamp = new Date(xmlYear,xmlMonth,1,0,0,0,0).getTime();

for (j=0;j<win.competitionInfoPanel.groupPanel.theGroup.children.length; j++) {
    if (win.competitionInfoPanel.groupPanel.theGroup.children[j].value == true) {xmlGroup = win.competitionInfoPanel.groupPanel.theGroup.children[j].text;}
    }
if (xmlGroup == win.competitionInfoPanel.groupPanel.theGroup.group_2.text) {xmlGroup = win.competitionInfoPanel.groupPanel.theGroup.group_2.text+" - "+win.competitionInfoPanel.groupPanel.theGroup.group_2_desc.text;}

for (k=0;k<win.competitionInfoPanel.scorePanel.theScore.children.length; k++) {
    if (win.competitionInfoPanel.scorePanel.theScore.children[k].value == true) {xmlScore = win.competitionInfoPanel.scorePanel.theScore.children[k].text;}
    }


// Add photo data to the xmlArray array. Later processed to generate an XML file.
xmlArray[xmlCurrentSelection] = [xmlDatestamp,xmlMonth,xmlYear,xmlGroup,xmlFilename,xmlTitle,xmlPhotographer,xmlScore];

}

function writeXML() {

// Sort the array by date in case entries from multiple competitions are made
// Sorts by the first array element, a date object (in milliseconds)
xmlArray.sort();

// Define xml tags
var xmlDeclaration = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n";
var xmlGalleryOpen =  "<gallery>";
var xmlGalleryClose =  "</gallery>";
var xmlCompetitionOpen =  "<competition>";
var xmlCompetitionClose =  "</competition>\n";

var xmlDatestampOpen = "<datestamp>";
var xmlDatestampClose = "</datestamp>";

var xmlMonthOpen = "<month>";
var xmlMonthClose = "</month>";

var xmlYearOpen = "<year>";
var xmlYearClose = "</year>";

var xmlGroupOpen = "<group>";
var xmlGroupClose = "</group>";

var xmlPhotoOpen = "<photo>";
var xmlPhotoClose = "</photo>";

var xmlImageOpen = "<image>";
var xmlImageClose = "</image>";

var xmlTitleOpen = "<title>";
var xmlTitleClose = "</title>";

var xmlAuthorOpen = "<author>";
var xmlAuthorClose = "</author>";

var xmlStatusOpen = "<status>";
var xmlStatusClose = "</status>";

var newXMLDoc  = xmlDeclaration+xmlGalleryOpen+xmlCompetitionOpen;

// Create a list of groups for this competition
var allGroupsArray=new Array();
for (m=0;m<win.competitionInfoPanel.groupPanel.theGroup.children.length; m++) {
if (win.competitionInfoPanel.groupPanel.theGroup.children[m].type == "radiobutton") {
   allGroupsArray[m] = win.competitionInfoPanel.groupPanel.theGroup.children[m].text;
   }
else {continue;}   
}


var xmlContent = xmlDeclaration;

for (n=0;n<xmlArray.length;n++) {

  var writeDatestamp    = xmlDatestampOpen+xmlArray[n][0]+xmlDatestampClose;
  var writeMonth        = xmlMonthOpen+xmlArray[n][1]+xmlMonthClose;
  var writeYear         = xmlYearOpen+xmlArray[n][2]+xmlYearClose;
  var writeGroup        = xmlGroupOpen+xmlArray[n][3]+xmlGroupClose;
  var writeFilename     = xmlImageOpen+xmlArray[n][4]+xmlImageClose;
  var writeTitle        = xmlTitleOpen+xmlArray[n][5]+xmlTitleClose;
  var writePhotographer = xmlAuthorOpen+xmlArray[n][6]+xmlAuthorClose;
  var writeScore        = xmlStatusOpen+xmlArray[n][7]+xmlStatusClose;

   xmlContent += xmlCompetitionOpen+"\n"+writeDatestamp+"\n"+writeMonth+"\n"+writeYear+"\n"+writeGroup+"\n"+writeFilename+"\n"+writeTitle+"\n"+writePhotographer+"\n"+writeScore+"\n"+xmlCompetitionClose+"\n";

  }



// create a reference to a file for output
var csvFile = new File(outputFolder+"gallery.xml");

// open the file, write the data, then close the file
csvFile.open('w');
csvFile.writeln(xmlContent+"</xml>");
csvFile.close();

}



// Eliminate duplicates from arrays. Used when sorting the xmlArray table to group datestamps and groups.
function eliminateDuplicates(a){
  a.sort();
  for(var i = 1; i < a.length; ){
    if(a[i-1] == a[i]){a.splice(i, 1);}
    else {i++;}
  }
return a;
} 