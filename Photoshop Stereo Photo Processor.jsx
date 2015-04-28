/* =================

Photoshop Stereo Photo Processor Script
Input: A parallel stereo image (a single, side-by-side, left image on the left)
Output: A suite of stereo photo jpegs, a layered Photoshop PSD with each format, and an XML manifest

Author: Mat Bergman
Web: www.matbergman.com
Version: 0.2, 4/28/2015
Source: https://github.com/matbergman/Photoshop-Stereo-Photo-Processor-Script
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
var inputFolder = Folder("/")
var outputFolder = ""
var inputFolderPlaceholder = "Select a folder with one or more parallel format .JPGs to process"
var outputFolderPlaceholder = "Choose a destination folder for formatted files, .PSDs, and an XML manifest"
var inputFolderValue
var outputFolderValue
var numberOfProcessedPhotos = 0

var jpegQuality = 6

var photoTitle
var maxResizedWidth
var maxResizedHeight
var theWidth
var theHeight
var theSelection
var anaglyphDocument

var xmlArray = new Array() // Holds the XML data before writing to a file
var xmlTitle   
var xmlPhotographer
var xmlMonth
var xmlMonthName
var xmlYear
var xmlDatestamp
var xmlGroup
var xmlFilename
var xmlParallel
var xmlCrosseyed
var xmlAnaglyphRedBlue
var xmlAnaglyphGreenMagenta
var xmlCurrentSelection // keeps track of the length of the xml array when new photos are added


// If input & output directories haven't been set, display placeholder text
if (inputFolder == "") {inputFolderValue = inputFolderPlaceholder}
else {inputFolderValue = inputFolder}
if (outputFolder == "") {outputFolderValue = outputFolderPlaceholder}
else {outputFolderValue = outputFolder}

// Path Information dialog. Set up file input & output paths.
var pathInfo =
"dialog { alignChildren: 'fill', \
    pathInfoPanel: Panel { orientation: 'column', alignChildren:'left',  \
        title: 'Path Information',\
        text: 'File Locations', \
        inputFolderInfo: Group { \
          orientation: 'row', \
          inputFolderBtn: Button { text:'Input path', properties:{name:'path_input'} }, \
          inputFolderLabel: StaticText { characters:100, text:'"+inputFolderValue+"' } \
        },\
        outputFolderInfo: Group { \
          orientation: 'row', \
          outputFolderBtn: Button { text:'Output path', properties:{name:'path_output'} }, \
          outputFolderLabel: StaticText { characters:100, text:'"+outputFolderValue+"' } \
        },\
      },\
    buttons_path: Group { orientation: 'row', \
    okBtn_path: Button { text:'Process Stereo Photos', properties:{name:'ok'} }, \
    cancelBtn_path: Button { text:'Cancel', properties:{name:'cancel'} } \
    } \
 }"
win_path = new Window (pathInfo, "Location and Destination of Files")

// Select Input Directory button
win_path.pathInfoPanel.outputFolderInfo.outputFolderBtn.onClick = function() {
  f = Folder()
  outputFolder = f.selectDlg("Select File Output Folder (all stereo formats, PSD, and XML manifest)")
  if (outputFolder != null) {
    win_path.pathInfoPanel.outputFolderInfo.outputFolderLabel.text = outputFolder  
    }
  }

// Select Output Directory button
win_path.pathInfoPanel.inputFolderInfo.inputFolderBtn.onClick = function() {
  f = Folder()
  inputFolder = f.selectDlg("Select parallel format .jpg files to process")
  if (inputFolder != null) {
    win_path.pathInfoPanel.inputFolderInfo.inputFolderLabel.text = inputFolder      
    }
  win_path.pathInfoPanel.inputFolderInfo.inputFolderLabel.text = inputFolder       
  }

// When the "OK" button is clicked, display next dialog to process photos
win_path.buttons_path.okBtn_path.onClick=processPhotos

// Show the window
win_path.center()
win_path.show()

/* == Collect information about each photo from the user via a dialog == */
function processPhotos() {

win_path.hide()

/* == Load jpegs from the input folder, check before processing == */
var fileList = inputFolder.getFiles("*.jpg")

// Let us know if it has trouble with the input files
if (fileList.length == 0) {alert("No files found in input folder: "+inputFolder)}

for (i=0;i<fileList.length;i++) {

  // The fileList is folders and files so open only files
  if (fileList[i] instanceof File) {
    open(fileList[i])

    // Create a dialog to collect data about the image
    // Pre-fill some fields with suggested defaults
    var theDate = new Date()
    var currentMonth = theDate.getMonth()
    var currentYear = theDate.getFullYear()
    var currentMonthArray = new Array("January","February","March","April","May","June","July","August","September","October","November","December")

    // Suggest a file name at the prompt, based on the existing filename. Strip the extension (assume a 3 letter extention).
    var photoName = app.activeDocument.name.slice(0,-4)
    xmlFilename = app.activeDocument.name
    var document_workfile = app.activeDocument

    // Photo Information dialog
    var photoInfo =
    "dialog { alignChildren: 'fill', \
      photoInfoPanel: Panel { orientation: 'column', alignChildren:'fill', spacing:20,  \
        text: 'Photo Information', \
        theTitle: Panel { orientation: 'column', alignChildren:'fill', spacing:10, \
          titleLabel: StaticText { text:'Title' }, \
          titleValue: EditText { characters: 30, justify:'left', text:'"+photoName+"'} \
          }, \
        thePhotographer: Panel { orientation: 'column', alignChildren:'fill', spacing:10,  \
          photographerLabel: StaticText { text:'Photographer' }, \
          thePhotographerFirstName: Group {orientation: 'row', \
            thePhotographerFirstNameLabel: StaticText { text:'First Name:' }, \
            thePhotographerFirstNameValue: EditText { characters:30, justify:'left' } \
            }, \
          thePhotographerLastName: Group {orientation: 'row', \
            thePhotographerLastNameLabel: StaticText { text:'Last Name:' }, \
            thePhotographerLastNameValue: EditText { characters:30, justify:'left' } \
            }, \
          }, \
        datePanel: Panel { orientation: 'column', alignChildren:'fill', spacing:10, \
          dateLabel: StaticText { text:'Date' }, \
          theDate: Group { orientation: 'row', \
            currentMonth: DropDownList { alignment:'left', title:'Month:',}, \
            currentYear_label: StaticText {text:'Year:'},\
            currentYear:  EditText { characters:4, text:'"+currentYear+"'}, \
            } \
          }, \
        description: Panel { orientation: 'column', alignChildren:'fill', spacing:10, \
          descriptionLabel: StaticText { text:'Description' }, \
          descriptionValue: EditText { characters: 60, justify:'left' } \
          } \
        }, \
      fileInfoPanel: Panel { orientation: 'column', alignChildren:'fill', spacing:20,  \
        text: 'File Save Options', \
        maxDimensions: Panel { orientation: 'column', alignChildren:'fill', spacing:10,  \
          maxDimensionsLabel: StaticText { text:'Maximum Dimensions' }, \
          maxDimensionsContainer: Group {orientation: 'row',  \
            maxWidth: Group {orientation: 'row', \
              maxWidthLabel: StaticText { text:'Max Width:' }, \
              maxWidthValue: EditText { characters:5, justify:'left', text:'"+parseInt(document_workfile.width)+"' } \
              }, \
            maxHeight: Group {orientation: 'row', \
              maxHeightLabel: StaticText { text:'Max Height:' }, \
              maxHeightValue: EditText { characters:5, justify:'left', text:'"+parseInt(document_workfile.height)+"' } \
              } \
            } \
          }, \
        formatPanel: Panel { orientation: 'row', \
          text:'Formats to Export',\
          theFormat: Group { orientation: 'row', \
            format_0: Checkbox { text:'Parallel', value:true }, \
            format_1: Checkbox { text:'Crosseyed', value:true }, \
            format_2: Checkbox { text:'Red/Blue Anaglyph', value:true }, \
            format_3: Checkbox { text:'Green/Magenta Anaglyph', value:true } \
            } \
          } \
        }, \
      buttons: Group { orientation: 'row', \
      okBtn: Button { text:'OK', properties:{name:'ok'} }, \
      cancelBtn: Button { text:'Cancel', properties:{name:'cancel'} } \
      } \
    }"
    win_options = new Window (photoInfo, "Stereo Photo Details")

    // Populate the month drop-down and select the current month
    var monthItem
    for (k=0;k<currentMonthArray.length;k++) {
        monthItem = win_options.photoInfoPanel.datePanel.theDate.currentMonth.add('item',currentMonthArray[k])
        }
    win_options.photoInfoPanel.datePanel.theDate.currentMonth.selection = win_options.photoInfoPanel.datePanel.theDate.currentMonth.items[currentMonth]

    // When the "OK" button is clicked, process the image
    win_options.buttons.okBtn.onClick=createStereoFiles

    // Show the window
    win_options.center()
    win_options.show()
    }
  }

// Generate an XML file based on the collected values stored in the xmlArray array
writeXML()

alert ("Process complete. "+fileList.length+" files detected, "+numberOfProcessedPhotos+" processed.")

/* == After running, reset the original preferences == */
app.preferences.rulerUnits = startRulerUnits
app.displayDialogs = startDisplayDialogs

}


/* == Create a suite of stereo images == */
function createStereoFiles() {

// Define this document's name for switching between documents
var document_workfile = app.activeDocument

// Make sure the document's color mode is RGB
if (document_workfile.mode !=DocumentMode.RGB) {document_workfile.changeMode(ChangeMode.RGB)}

theWidth = document_workfile.width
theHeight = document_workfile.height
   
// Get the photo's title from the dialog
photoTitle = win_options.photoInfoPanel.theTitle.titleValue.text

// Close the dialog to give some feedback that the process has started
win_options.close()


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
var redMix      = "Array(Array(100,0,0,0),Array(0,0,0,0),Array(0,0,0,0))" 
var blueMix     = "Array(Array(0,0,0,0),Array(0,100,0,0),Array(0,0,100,0))" 
var greenMix    = "Array(Array(0,0,0,0),Array(0,100,0,0),Array(0,0,0,0))" 
var magentaMix  = "Array(Array(100,0,0,0),Array(0,0,0,0),Array(0,0,100,0))" 

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
   var moveAmount = (theWidth/2)*-1
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


/* == Save and export files == */

// Save a PSD of these changes
var psdOptions = new PhotoshopSaveOptions()
psdOptions.embedColorProfile = false
psdOptions.layers = true
document_workfile.saveAs(new File(outputFolder+"/"+photoTitle+"_stereo.psd"),psdOptions)

// Resize output images
resize(document_workfile)

// Sharpen each layer after resizing
for (m=0; m<document_workfile.layerSets.length; m++) {
   for (n=0; n<document_workfile.layerSets[m].artLayers.length; n++) {
      document_workfile.layerSets[m].artLayers[n].applyUnSharpMask(25,1,0)
      }
   }

var jpegOptions = new JPEGSaveOptions()
jpegOptions.quality = jpegQuality

// Save parallel view
if (win_options.fileInfoPanel.formatPanel.theFormat.format_0.value == true) {
  displayLayerSet("parallel")

  // Replace spaces with underscores, and make all file names lowercase
  document_workfile.saveAs(new File(outputFolder+"/"+photoTitle.replace(/ /g,'_').toLowerCase()+'_parallel.jpg'), jpegOptions)
  }


// Save crosseyed view
if (win_options.fileInfoPanel.formatPanel.theFormat.format_1.value == true) {
  displayLayerSet("crosseyed")
  document_workfile.saveAs(new File(outputFolder+"/"+photoTitle.replace(/ /g,'_').toLowerCase()+'_crosseyed.jpg'), jpegOptions)
  }


// Save red/blue anaglyph view
if (win_options.fileInfoPanel.formatPanel.theFormat.format_2.value == true) {
  // Merge the left and right images and copy both
  displayLayerSet("redBlue")     
  activeLayer = layerSet_redBlue.layers["left"]
  activeLayer.merge()
  document_workfile.activeLayer.copy(true)

  // Since the anaglyph image is half as wide as the workfile, create a new image with the correct dimensions
  document_anaglyph_redBlue = app.documents.add(document_workfile.width/2,document_workfile.height,72,"anaglyphDocument",NewDocumentMode.RGB)
  document_anaglyph_redBlue.paste()
  document_workfile.saveAs(new File(outputFolder+"/"+photoTitle.replace(/ /g,'_').toLowerCase()+'_anaglyph-redBlue.jpg'), jpegOptions)

  // Switch back to the workfile document
  app.activeDocument=document_workfile
  }

// Save green/magenta anaglyph view
if (win_options.fileInfoPanel.formatPanel.theFormat.format_3.value == true) {
  // Merge the left and right images and copy both
  displayLayerSet("greenMagenta")    
  activeLayer = layerSet_greenMagenta.layers["left"]
  activeLayer.merge()
  document_workfile.activeLayer.copy(true)
  document_anaglyph_greenMagenta = app.documents.add(document_workfile.width/2,document_workfile.height,72,"anaglyphDocument",NewDocumentMode.RGB)
  document_anaglyph_greenMagenta.paste()
  document_workfile.saveAs(new File(outputFolder+"/"+photoTitle.replace(/ /g,'_').toLowerCase()+'_anaglyph-greenMagenta.jpg'), jpegOptions)
  app.activeDocument=document_workfile
  }


// Close the documents
document_workfile.close(SaveOptions.DONOTSAVECHANGES)
if (document_anaglyph_redBlue) {document_anaglyph_redBlue.close(SaveOptions.DONOTSAVECHANGES)}
if (document_anaglyph_greenMagenta) {document_anaglyph_greenMagenta.close(SaveOptions.DONOTSAVECHANGES)}

numberOfProcessedPhotos++ // Displayed after processing all images is complete

// Generate an entry for the XML file
createXML()

}


function resize(doc) {

maxResizedWidth = win_options.fileInfoPanel.maxDimensions.maxDimensionsContainer.maxWidth.maxWidthValue.text
maxResizedHeight = win_options.fileInfoPanel.maxDimensions.maxDimensionsContainer.maxHeight.maxHeightValue.text

if ((doc.width/2) > doc.height) {
    // Horizontal images: resize to max width
   doc.resizeImage(UnitValue(maxResizedWidth,"px"),null,null,ResampleMethod.BICUBIC)
   }
else {
   // Vertical images: resize to max height
   doc.resizeImage(null,UnitValue(maxResizedHeight,"px"),null,ResampleMethod.BICUBIC)
   }   
}

function saturation(HAmt,StrtAmt,LghtAmt) {
var idHStr = charIDToTypeID("HStr")
var desc2 = new ActionDescriptor()
var idpresetKind = stringIDToTypeID("presetKind")
var idpresetKindType = stringIDToTypeID("presetKindType")
var idpresetKindCustom = stringIDToTypeID("presetKindCustom")
desc2.putEnumerated(idpresetKind, idpresetKindType, idpresetKindCustom)
var idClrz = charIDToTypeID("Clrz")
desc2.putBoolean(idClrz, false)
var idAdjs = charIDToTypeID("Adjs")
  var list1 = new ActionList()
      var desc3 = new ActionDescriptor()
      var idH = charIDToTypeID("H   ")
      desc3.putInteger( idH, HAmt )
      var idStrt = charIDToTypeID("Strt")
      desc3.putInteger(idStrt, StrtAmt)
      var idLght = charIDToTypeID("Lght")
      desc3.putInteger(idLght, LghtAmt)
  var idHsttwo = charIDToTypeID("Hst2")
  list1.putObject(idHsttwo, desc3)
desc2.putList(idAdjs, list1)
executeAction(idHStr, desc2, DialogModes.NO)
}

function applyAnaglyph(mix, layerName) {layerName.mixChannels(eval(mix))}

function displayLayerSet(theLayerSet) {

// Define this document's name for switching between documents
var document_workfile = app.activeDocument

// Hide all groups
for (s=0;s<document_workfile.layerSets.length;s++) {
   document_workfile.layerSets[s].visible = false
   }
   
// Display the selected group for export   
document_workfile.layerSets.getByName(theLayerSet).visible = true
}


/* == Create an XML file for export == */
function createXML() {

xmlCurrentSelection = xmlArray.length
xmlMonth =  win_options.photoInfoPanel.datePanel.theDate.currentMonth.selection
xmlMonthName =  win_options.photoInfoPanel.datePanel.theDate.currentMonth.selection.text
xmlYear = parseInt(win_options.photoInfoPanel.datePanel.theDate.currentYear.text)
xmlDatestamp = new Date(xmlYear,xmlMonth,1,0,0,0,0).getTime()
xmlTitle = win_options.photoInfoPanel.theTitle.titleValue.text
xmlPhotographerFirstname = win_options.photoInfoPanel.thePhotographer.thePhotographerFirstName.thePhotographerFirstNameValue.text
xmlPhotographerLastname = win_options.photoInfoPanel.thePhotographer.thePhotographerLastName.thePhotographerLastNameValue.text
xmlDescription = win_options.photoInfoPanel.description.descriptionValue.text
xmlWidth = theWidth
xmlHeight = theHeight

if (win_options.fileInfoPanel.formatPanel.theFormat.format_0.value === true) xmlParallel = "True"
else xmlParallel = "False"

if (win_options.fileInfoPanel.formatPanel.theFormat.format_1.value === true) xmlCrosseyed = "True"
else xmlCrosseyed = "False"

if (win_options.fileInfoPanel.formatPanel.theFormat.format_2.value === true) xmlAnaglyphRedBlue = "True"
else xmlAnaglyphRedBlue = "False"

if (win_options.fileInfoPanel.formatPanel.theFormat.format_3.value === true) xmlAnaglyphGreenMagenta = "True"
else xmlAnaglyphGreenMagenta = "False"

// Add photo data to the xmlArray array. Later processed to generate an XML file.
xmlArray[xmlCurrentSelection] = [xmlDatestamp,xmlMonthName,xmlYear,xmlFilename,xmlTitle,xmlPhotographerFirstname,xmlPhotographerLastname,xmlDescription,xmlWidth,xmlHeight,xmlParallel,xmlCrosseyed,xmlAnaglyphRedBlue,xmlAnaglyphGreenMagenta]

}

function writeXML() {

// Sort the array by date in case entries from multiple competitions are made
// Sorts by the first array element, a date object (in milliseconds)
xmlArray.sort()

// Define xml tags
var xmlDeclaration = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n"
var xmlGalleryOpen =  "<gallery>"
var xmlGalleryClose =  "</gallery>"
var xmlSetOpen =  "<set>"
var xmlCompetitionClose =  "</set>\n"

var xmlDatestampOpen = "<datestamp>"
var xmlDatestampClose = "</datestamp>"

var xmlMonthOpen = "<month>"
var xmlMonthClose = "</month>"

var xmlYearOpen = "<year>"
var xmlYearClose = "</year>"

var xmlFilenameOpen = "<filename>"
var xmlFilenameClose = "</filename>"

var xmlTitleOpen = "<title>"
var xmlTitleClose = "</title>"

var xmlFirstnameOpen = "<firstname>"
var xmlFirstnameClose = "</firstname>"

var xmlLastnameOpen = "<lastname>"
var xmlLastnameClose = "</lastname>"

var xmlDescriptionOpen = "<description>"
var xmlDescriptionClose = "</description>"

var xmlWidthOpen = "<width>"
var xmlWidthClose = "</width>"

var xmlHeightOpen = "<height>"
var xmlHeightClose = "</height>"

var xmlParallelOpen = "<parallel>"
var xmlParallelClose = "</parallel>"

var xmlCrosseyedOpen = "<crosseyed>"
var xmlCrosseyedClose = "</crosseyed>"

var xmlAnaglyphRedBlueOpen = "<anaglyphredblue>"
var xmlAnaglyphRedBlueClose = "</anaglyphredblue>"

var xmlAnaglyphGreenMagentaOpen = "<anaglyphgreenmagenta>"
var xmlAnaglyphGreenMagentaClose = "</anaglyphgreenmagenta>"

var xmlContent = xmlDeclaration+xmlGalleryOpen+"\n"

// Create content for XML file
for (n=0;n<xmlArray.length;n++) {

  var writeDatestamp    = xmlDatestampOpen+xmlArray[n][0]+xmlDatestampClose
  var writeMonth        = xmlMonthOpen+xmlArray[n][1]+xmlMonthClose
  var writeYear         = xmlYearOpen+xmlArray[n][2]+xmlYearClose
  var writeFilename     = xmlFilenameOpen+xmlArray[n][3]+xmlFilenameClose
  var writeTitle        = xmlTitleOpen+xmlArray[n][4]+xmlTitleClose
  var writeFirstname    = xmlFirstnameOpen+xmlArray[n][5]+xmlFirstnameClose
  var writeLastname     = xmlLastnameOpen+xmlArray[n][6]+xmlLastnameClose
  var writeDescription  = xmlDescriptionOpen+xmlArray[n][7]+xmlDescriptionClose
  var writeWidth        = xmlWidthOpen+xmlArray[n][8]+xmlWidthClose
  var writeHeight       = xmlHeightOpen+xmlArray[n][9]+xmlHeightClose
  var writeParallel     = xmlParallelOpen+xmlArray[n][10]+xmlParallelClose
  var writeCrosseyed    = xmlCrosseyedOpen+xmlArray[n][11]+xmlCrosseyedClose
  var writeAnaglyphRedBlue      = xmlAnaglyphRedBlueOpen+xmlArray[n][12]+xmlAnaglyphRedBlueClose
  var writeAnaglyphGreenMagenta = xmlAnaglyphGreenMagentaOpen+xmlArray[n][13]+xmlAnaglyphGreenMagentaClose

  xmlContent += xmlSetOpen+"\n"+writeDatestamp+"\n"+writeMonth+"\n"+writeYear+"\n"+writeFilename+"\n"+writeTitle+"\n"+writeFirstname+"\n"+writeLastname+"\n"+writeWidth+"\n"+writeHeight+"\n"+writeParallel+"\n"+writeCrosseyed+"\n"+writeAnaglyphRedBlue+"\n"+writeAnaglyphGreenMagenta+"\n"+xmlCompetitionClose+"\n"
  }

// create a reference to a file for output
var csvFile = new File(outputFolder+"/stereo_manifest.xml")

// open the file, write the data, then close the file
csvFile.open('w')
csvFile.writeln(xmlContent+xmlGalleryClose)
csvFile.close()

}