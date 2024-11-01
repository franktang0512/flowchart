var title = "總傷害";
var question = "戰鬥遊戲過程會不停的累計傷害量。請寫程式統計並輸出總傷害量，輸入-1時代表戰鬥結束。\n";
var array = [
    /*["重量限制", "郵資費用"],
    ["不逾5公斤", "70"],
    ["逾5公斤、不逾10公斤", "90"],
    ["逾10公斤、不逾15公斤", "110"],
    ["逾15公斤、不逾20公斤", "135"]*/
]
var test_case = [
    {
        input: "10 15 20 -1",
        output: "45",
        note: "造成的傷害分別為10、15、20，共造成45點傷害。"
    },
    {
        input: "1 2 4 8 16 32 64 -1",
        output: "127",
        note: "造成的傷害分別為1、2、4、8、16、32、64，共造成127點傷害。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input.replaceAll("\n","<br>")+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})