var title = "施放魔法";
var question = "玩家魔力上限為100，每次施放魔法會消耗魔力，魔力歸零或魔力不足便無法施放魔法。請計算玩家剩餘多少魔力，以及總共施放幾次魔法。\n(如果剩下10魔力，卻想施放消耗超過10魔力的魔法會無法施放。)\n";
var array = [
    /*["重量限制", "郵資費用"],
    ["不逾5公斤", "70"],
    ["逾5公斤、不逾10公斤", "90"],
    ["逾10公斤、不逾15公斤", "110"],
    ["逾15公斤、不逾20公斤", "135"]*/
]
var test_case = [
    {
        input: "5 10 15 20 24 30",
        output: "26 5",
        note: "依序放出消耗為5、10、15、20、24的魔法後，剩餘26魔力，魔力不足以施放30的魔法。因此共施放5次魔法。"
    },
    {
        input: "100 50",
        output: "0 1",
        note: "放出消耗為100的魔法後，魔力用光。共施放1次魔法。"
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