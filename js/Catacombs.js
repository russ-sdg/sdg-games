const bibleBooks = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];

const bookCategories = ["Pentatuch","Pentatuch","Pentatuch","Pentatuch","Pentatuch","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Historical","Wisdom","Wisdom","Wisdom","Wisdom","Wisdom","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Prophets","Gospel","Gospel","Gospel","Gospel","Gospel","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","Paul","General","General","General","General","General","General","General","General","General"];

const cardImages = ["1Chronicles1v1","1Corinthians1v2","1John1v1","1John2v1","1Kings1v1","1Peter1v1","1Peter2v1","1Samuel1v1","1Thessalonians1v2","1Timothy1v2","2Chronicles1v1","2Corinthians1v2","2John1v1","2Kings1v1","2Peter1v1","2Samuel1v1","2Thessalonians1v2","2Timothy1v2","3John1v1","Acts1v1","Amos1v1","Colossians1v2","Daniel1v1","Deuteronomy1v1","Deuteronomy2v2","Ecclesiastes1v1","Ecclesiastes2v1","Ephesians1v2","Esther1v1","Exodus1v1","Exodus2v1","Exodus3v1","Ezekiel1v1","Ezra1v1","Galatians1v2","Genesis1v1","Genesis2v1","Habakkuk1v1","Haggai1v1","Hebrews1v1","Hosea1v1","Isaiah1v1","James1v1","James2v1","Jeremiah1v1","Job1v1","Job2v1","Joel1v1","John1v1","John2v1","John3v1","Jonah1v1","Joshua1v1","Jude1v1","Judges1v1","Lamentations1v1","Leviticus1v1","Leviticus2v1","Leviticus3v1","Luke1v1","Luke2v1","Luke3v1","Malachi1v1","Mark1v1","Mark2v1","Mark3v1","Matthew1v1","Matthew2v1","Micah1v1","Nahum1v1","Nehemiah1v1","Numbers1v1","Numbers2v1","Obadiah1v1","Philemon1v2","Philippians1v2","Proverbs1v1","Proverbs2v1","Proverbs3v1","Psalms1v1","Psalms2v1","Psalms3v1","Psalms4v1","Revelation1v1","Romans1v2","Ruth1v1","Song1v1","Titus1v2","Zechariah1v1","Zephaniah1v1"];

const categories = ["Pentatuch","Historical","Wisdom","Prophets","Gospel","Paul","General"];
const Lows = [1,6,18,23,40,45,58];
const Highs = [5,17,22,39,44,57,66];

const bookSlotsA = ["PentatuchA","PentatuchB","PentatuchC","HistoricalA","HistoricalB","HistoricalC","WisdomA","WisdomB","WisdomC","ProphetsA","ProphetsB","ProphetsC","GospelA","GospelB","GospelC","PaulA","PaulB","PaulC","GeneralA","GeneralB","GeneralC"];

const bookSlots1 = ["Pentatuch1","Pentatuch2","Pentatuch3","Historical1","Historical2","Historical3","Wisdom1","Wisdom2","Wisdom3","Prophets1","Prophets2","Prophets3","Gospel1","Gospel2","Gospel3","Paul1","Paul2","Paul3","General1","General2","General3"];

const shortCategories = ["Pentatuch","Historical","Wisdom","Prophets","Gospel","Paul","General"];

const longCategories = ["Pentatuch","Historical Books","Wisdom Books","Prophets","Gospel & Acts","Paul's Epistles","General Epistles"];

const highScore = [9,7,10,6,9,7,8];
const lowScore = [6,5,7,4,6,5,5];

const cookieTime = 1; //days

var score = -21;
var lastChanged1 = "";
var lastChangedA = "";
var curCard = 0;

// find the index for a match in an array

function getIndex(array,match) {
    return array.findIndex( rank => rank === match);
}

// Cookie functions from w3schools
function setCookie(cname, cvalue, exdays) {
   var d = new Date();
   d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
   var expires = "expires=" + d.toUTCString();
   document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
   var name = cname + "=";
   var decodedCookie = decodeURIComponent(document.cookie);
   var ca = decodedCookie.split(';');
   for (var i = 0; i < ca.length; i++) {
       var c = ca[i];
       while (c.charAt(0) === ' ') {
           c = c.substring(1);
       }
       if (c.indexOf(name) === 0) {
           return c.substring(name.length, c.length);
       }
   }
   return "";
}

function initializeRC() {

    // Look for cookies to reload data from last play
    var cookieValue = "";

    for(let i = 0; i < bookSlots1.length; i++) {
        cookieValue = getCookie(bookSlots1[i]);
        if(cookieValue.length > 0) {
            updateScorepad(bookSlots1[i],cookieValue);
            updateBookList(bookSlots1[i],cookieValue);
        }
    }

    for(let i = 0; i < categories.length; i++) {
        cookieValue = getCookie("Score"+categories[i]);
        if(cookieValue.length > 0) {
            scoreCategory(categories[i],cookieValue);
        }
        cookieValue = getCookie(categories[i]+"Claimed");
        if((cookieValue.length > 0) && (cookieValue == 1)) {
            clearScoreOptions(categories[i]);
        }
    }

    scoreRC();


    $("#scorepadbutton").on("click",function() {
        $("#scorepad").show();
        $("#rules").hide();
        $("#booklist").hide();
        $("#playdiv").hide();
    });

    $("#rulesbutton").on("click",function() {
        $("#scorepad").hide();
        $("#rules").show();
        $("#booklist").hide();
        $("#playdiv").hide();
    });

    $("#booksbutton").on("click",function() {
        $("#scorepad").hide();
        $("#rules").hide();
        $("#playdiv").hide();
        $("#booklist").show();
    });

    $("#playbutton").on("click",function() {
        $("#scorepad").hide();
        $("#rules").hide();
        $("#booklist").hide();
        $("#playdiv").show();
    });

    $("#restart").on("click",function() {
        restart();
    });

    $("#shuffle").on("click",function() {
        shuffle(cardImages);

        curCard = 0;
        $("#cardback2").html('<img id="back1" src="../assets/Backv2sm.png">');
        $("#cardback3").html('<img id="back1" src="../assets/Backv2sm.png">');
        $("#cardface1").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
        $("#cardface2").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
        $("#cardface3").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
        $("#playinstructions").html('Click on a card back to play the next three cards.');
    });

    $(".cardback").on("click",function() {
        if(curCard < (21*3)) {
            $("#cardface1").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
            $("#cardface2").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
            $("#cardface3").html('<img id="'+cardImages[curCard]+'" src="../assets/'+cardImages[curCard++]+'sm.png">');
        }
    });

    $(".cards").on("change",function() {
        var thisBook = this.value;
        var id = $(this).attr('id');

        // get category name
        var category = id.slice(0,-1);

        // update scorepad options based on selection
        updateScorepad(id,thisBook);

        // update the book list options as appropriate
        updateBookList(id,thisBook);

        // set the cookie
        setCookie(id,thisBook,cookieTime);

        // check if this category has been completed
        checkCompleted(category);

        scoreRC();
    });

    $(".BookSelect").on("change",function() {
        var position = this.value;
        var book = Number($(this).attr('id').slice(-2));

        // get category name
        var category = bookCategories[book-1];

        // build id
        var id = category+position;

        // update scorepad options based on selection
        updateScorepad(id,book);


        // update the book list options as appropriate
        updateBookList(id,book);


        // set the cookie
        setCookie(id,book,cookieTime);

        // check if this category has been completed
        checkCompleted(category);

        scoreRC();

    });

    $(".CategoryScore").on("click",function() {
        var category = $(this).attr('id').slice(0,-5);

        var longCategory = longCategories[getIndex(shortCategories,category)];

        if(getCookie(category+"Claimed") != '1') {
            $( "#claimeddialog" ).dialog({
              dialogClass: "no-close",
              title: longCategory,
              buttons: [
                {
                  text: "Yes",
                  click: function() {
                    $( this ).dialog( "close" );
                    setCookie(category+"Claimed",1,cookieTime);
                    clearScoreOptions(category);
                  }
                },
                {
                  text: "No",
                  click: function() {
                    $( this ).dialog( "close" );
                    setCookie(category+"Claimed",0,cookieTime);
                  }
                }
              ]
            });
        }

    });

    $(".BookHead").on("click",function() {
        var category = $(this).attr('id').slice(0,-4);

        var longCategory = longCategories[getIndex(shortCategories,category)];

        if(getCookie(category+"Claimed") != '1') {
            $( "#claimeddialog" ).dialog({
              dialogClass: "no-close",
              title: longCategory,
              buttons: [
                {
                  text: "Yes",
                  click: function() {
                    $( this ).dialog( "close" );
                    setCookie(category+"Claimed",1,cookieTime);
                    clearScoreOptions(category);
                  }
                },
                {
                  text: "No",
                  click: function() {
                    $( this ).dialog( "close" );
                    setCookie(category+"Claimed",0,cookieTime);
                  }
                }
              ]
            });
        }

    });


}

function clearScoreOptions(category) {
    var score = lowScore[getIndex(shortCategories,category)];
    var longCategory = longCategories[getIndex(shortCategories,category)];

    $('#'+category+'Score').html(score).css('background-image', 'none');
    $('#'+category+'Head').html(longCategory+" <span style='font-weight: normal;'>"+score+"</span>").css('background-image', 'none');
}

function updateScorepad(id,thisBook) {
            // get category names
        var category = id.slice(0,-1);
        var longCategory = longCategories[getIndex(shortCategories,category)];
        var idA = bookSlotsA[getIndex(bookSlots1,id)];

        // lock in this book
        $("#"+idA).html(bibleBooks[thisBook-1]+" <input type=hidden id='"+ id + "' value="+thisBook+">");


        // update scorepad options based on selection

        // handle differently whether this is 1, 2, or 3
        var leftSlot = category+"1";
        var centerSlot = category+"2";
        var rightSlot = category+"3";

        switch(id.slice(-1)) {

            case "1":
                $("#"+centerSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) <= Number(thisBook)) {
                            this.remove();
                        }
                    }
                });
                $("#"+rightSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) <= (Number(thisBook)+1)) {
                            this.remove();
                        }
                    }
                });
                break;

            case "2":
                $("#"+leftSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) >= Number(thisBook)) {
                            this.remove();
                        }
                    }
                });
                $("#"+rightSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) <= Number(thisBook)) {
                            this.remove();
                        }
                    }
                });
                break;

            default:
                $("#"+leftSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) >= (Number(thisBook)-1)) {
                            this.remove();
                        }
                    }
                });
                $("#"+centerSlot+" > option").each(function() {
                    if(this.value > 0) {
                        if(Number(this.value) >= Number(thisBook)) {
                            this.remove();
                        }
                    }
                });

        }

}

function updateBookList(id,thisBook) {
    var position = id.slice(-1);
    var category = id.slice(0,-1);
    var categoryId = getIndex(categories,category);

    $("#Li"+ String(thisBook).padStart(2, '0')).html(position+": "+ bibleBooks[(thisBook-1)]).addClass("chosen");

    // handle differently whether this is 1, 2, or 3
    switch(position) {

        case "1":
            // deselect all books before this one in the category
            for (let i = Lows[categoryId]; i < thisBook; i++) {
                $("#Li"+ String(i).padStart(2, '0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
            }
            // remove the 1 option from all remaining books
            for (let i = Number(thisBook)+1; i< Highs[categoryId]; i++) {
                $("#Book"+ String(i).padStart(2,'0')+" option[value='1']").remove();
                // check if any remaining
                if($("#Book"+ String(i).padStart(2,'0')+" option").length == 1) {
                    $("#Li"+ String(i).padStart(2,'0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
                }
            }
            break;

        case "2":
            // remove the 2 and 3 options from all books before this one
            for (let i = Lows[categoryId]; i < thisBook; i++) {
                $("#Book"+ String(i).padStart(2,'0')+" option[value='2']").remove();
                $("#Book"+ String(i).padStart(2,'0')+" option[value='3']").remove();
                if($("#Book"+ String(i).padStart(2,'0')+" option").length == 1) {
                    $("#Li"+ String(i).padStart(2,'0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
                }
            }
            // remove the 2 and 1 option from all books after this one
            for (let i = Number(thisBook)+1; i< Highs[categoryId]; i++) {
                $("#Book"+ String(i).padStart(2,'0')+" option[value='1']").remove();
                $("#Book"+ String(i).padStart(2,'0')+" option[value='2']").remove();
                if($("#Book"+ String(i).padStart(2,'0')+" option").length == 1) {
                    $("#Li"+ String(i).padStart(2,'0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
                }
            }
            break;

        default:
            // deselect all books after this one in the category
            for (let i = (Number(thisBook)+1); i <= Highs[categoryId]; i++) {
                $("#Li"+ String(i).padStart(2, '0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
            }
            // remove the 3 option from all remaining books
            for (let i = Lows[categoryId]; i < thisBook; i++) {
                $("#Book"+ String(i).padStart(2,'0')+" option[value='3']").remove();
                if($("#Book"+ String(i).padStart(2,'0')+" option").length == 1) {
                    $("#Li"+ String(i).padStart(2,'0')).html("  "+ bibleBooks[(i-1)]).addClass("grey");
                }
            }

    }


}

function checkCompleted(category) {
    var leftSlot = category+"1";
    var centerSlot = category+"2";
    var rightSlot = category+"3";
    var longCategory = longCategories[getIndex(shortCategories,category)];

    // get scores
    var high = highScore[getIndex(shortCategories,category)];
    var low = lowScore[getIndex(shortCategories,category)];

    if(getCookie(category+"Claimed") == '1') {
            scoreCategory(category,low);

            // set the cookie
            setCookie('Score'+category,low,cookieTime);

            scoreRC();

        }
    else {
        if(($('#'+leftSlot).val() > 0) && ($('#'+centerSlot).val() > 0) && ($('#'+rightSlot).val() > 0)) {
            $( "#dialog" ).dialog({
              dialogClass: "no-close",
              title: longCategory,
              buttons: [
                {
                  text: "Yes",
                  click: function() {
                    $( this ).dialog( "close" );
                    scoreCategory(category,high);

                    // set the cookie
                    setCookie('Score'+category,high,cookieTime);

                    scoreRC();
                  }
                },
                {
                  text: "No",
                  click: function() {
                    $( this ).dialog( "close" );
                    scoreCategory(category,low);

                    // set the cookie
                    setCookie('Score'+category,low,cookieTime);

                    scoreRC();
                  }
                }
              ]
            });
        }
    }

}

function scoreCategory(category,score) {
    var longCategory = longCategories[getIndex(shortCategories,category)];

    $('#'+category+'Score').html("<strong>"+score+"</strong>").css('background-image', 'none');
    $('#'+category+'Head').html(longCategory+" "+score).css('background-image', 'none');
    $('#Score'+category).val(score);

}

function scoreRC() {
    score = Number($('#ScorePentatuch').val())+
            Number($('#ScoreHistorical').val())+
            Number($('#ScoreWisdom').val())+
            Number($('#ScoreProphets').val())+
            Number($('#ScoreGospel').val())+
            Number($('#ScorePaul').val())+
            Number($('#ScoreGeneral').val());

    if($('#Pentatuch1').val() < 1) score=score-1;
    if($('#Pentatuch2').val() < 1) score=score-1;
    if($('#Pentatuch3').val() < 1) score=score-1;
    if($('#Historical1').val() < 1) score=score-1;
    if($('#Historical2').val() < 1) score=score-1;
    if($('#Historical3').val() < 1) score=score-1;
    if($('#Wisdom1').val() < 1) score=score-1;
    if($('#Wisdom2').val() < 1) score=score-1;
    if($('#Wisdom3').val() < 1) score=score-1;
    if($('#Prophets1').val() < 1) score=score-1;
    if($('#Prophets2').val() < 1) score=score-1;
    if($('#Prophets3').val() < 1) score=score-1;
    if($('#Gospel1').val() < 1) score=score-1;
    if($('#Gospel2').val() < 1) score=score-1;
    if($('#Gospel3').val() < 1) score=score-1;
    if($('#Paul1').val() < 1) score=score-1;
    if($('#Paul2').val() < 1) score=score-1;
    if($('#Paul3').val() < 1) score=score-1;
    if($('#General1').val() < 1) score=score-1;
    if($('#General2').val() < 1) score=score-1;
    if($('#General3').val() < 1) score=score-1;

    $('select').blur();

    $("#score").text(score);
}

function restart() {
    var cookies = document.cookie.split(";");
    for(var i=0; i < cookies.length; i++) {
        var equals = cookies[i].indexOf("=");
        var name = equals > -1 ? cookies[i].substr(0, equals) : cookies[i];
        setCookie(name, "0", 0);
    }
    location.reload(true);
}

function shuffle(array) {
    var m = new MersenneTwister();
    let currentIndex = array.length, randomIndex;

    while (currentIndex != 0) {
        // pick a remaining element
        randomIndex = Math.floor(m.random() * currentIndex);
        currentIndex--;

        // swap them
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    console.log("Shuffled Deck:");
    for(let i=0;i<array.length;i++) console.log(array[i]);
    return array;
}
