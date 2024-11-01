var title = "終極密碼(1~100)";
var question = "老師先隨機挑選一個1~100的數字讓5位學生來猜，猜到就贏了！\n猜到時恭喜該位學生！沒猜到的話恭喜老師！";
var array = [
    /*["抽中號碼", "獎項"],
    ["1", "頭獎"],
    ["2~3", "二獎"],
    ["4~10", "三獎"],
    ["11~100", "四獎"]*/
]
var test_case = [
    {
        input: "25\n2 95 5 20 26",
        output: "恭喜老師",
        note: "密碼設定為25，學生依序猜測2、95、5、20、26。沒人猜到，恭喜老師"
    },
    {
        input: "50\n30 70 50",
        output: "恭喜3號學生",
        note: "密碼設定為50，學生依序猜測30、70、50，由3號學生猜到"
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