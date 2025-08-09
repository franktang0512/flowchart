var title = "密碼鎖";
var question = "玩密室逃脫遊戲時，門上的鎖需要三位數密碼才能解開。\n三位數密碼依序為：圓形積木總數量的個位數、三角形積木總數量的個位數、正方形積木總數量的個位數。\n房間內有許多箱子，箱子內有各種積木。請解開密碼鎖，逃出密室。\n(提示：將數字除以10，餘數即為個位數。)\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "2<br>5 8 2<br>10 0 3",
        output: "585",
        note: "有2個箱子，第一個箱子，圓形積木有5個，三角形積木有8個，正方形積木有2個；第二個箱子，圓形積木有10個，三角形積木有0個，正方形積木有3個。<br>圓形的數量是5+10=15，三角形的數量是8+0=8，正方形的總數量是2+3=5，因此密碼為585。"
    },
    {
        input: "3<br>7 2 4<br>3 5 8<br>2 0 0",
        output: "272",
        note: "有3個箱子，第一個箱子，圓形積木有7個，三角形積木有2個，正方形積木有4個，以此類推。<br>圓形的數量是7+3+2=12，三角形的數量是2+5+0=7，正方形的總數量是4+8+0=12，因此密碼為272。"
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
                <td style="width: 20%;">'+test_case[i].input+'</td>\
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